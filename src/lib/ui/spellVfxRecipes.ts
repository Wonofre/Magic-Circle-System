import type { CastResult } from "@/lib/spellEngine";
import type { ElementSigilId } from "@/types/magicFormulaV2";
import type { MotionIntensity } from "@/lib/ui/motionTokens";
import { elementalAccent } from "@/lib/ui/themeTokens";
import { getElementVfxProfile, type ParticleKind, type RingStyle } from "@/lib/ui/elementVfxProfiles";
import { createSpellVfxRandom } from "@/lib/ui/spellVfxSeed";
import { getCastIntensity } from "@/lib/ui/turnPresentationDirector";

export interface SpellVfxRecipe {
  readonly spellHash: string;
  readonly element: ElementSigilId | "neutral";
  readonly color: string;
  readonly wash: string;
  readonly secondaryColor: string;
  readonly tertiaryColor: string;
  readonly motion: "strike" | "mend" | "ward" | "fizzle";
  readonly destinationLane: "opponent" | "caster" | "field";
  readonly particleCount: number;
  readonly sparkCount: number;
  readonly ringCount: number;
  readonly rotation: number;
  readonly intensity: MotionIntensity;
  readonly particleKind: ParticleKind;
  readonly ringStyle: RingStyle;
  readonly bloomScale: number;
  readonly durationMs: number;
  readonly impactStrength: number;
  readonly isSuccess: boolean;
  readonly precision: number;
}

type VfxCastResult = CastResult & { readonly spellHash?: string };

const primaryElement = (result: VfxCastResult): ElementSigilId | "neutral" =>
  result.effects[0]?.element ?? result.formula?.sigils[0]?.sigilId ?? "neutral";

const intensityDurationBonus: Record<MotionIntensity, number> = {
  quiet: 0,
  normal: 180,
  dramatic: 420,
};

export const createSpellVfxRecipe = (result: VfxCastResult): SpellVfxRecipe => {
  const element = primaryElement(result);
  const spellHash = result.spellHash ?? `${result.spellName}-${element}`;
  const random = createSpellVfxRandom(spellHash);
  const profile = getElementVfxProfile(element);
  const accent = element === "neutral"
    ? { glow: "#e8c86a", wash: "rgba(232, 200, 106, 0.2)" }
    : elementalAccent[element];
  const potency = Math.max(result.damage, result.healing, result.shield, result.precision);
  const intensity = getCastIntensity(potency);
  const motion = !result.isSuccess
    ? "fizzle"
    : result.healing > 0
      ? "mend"
      : result.shield > 0
        ? "ward"
        : "strike";
  const destinationLane = result.damage > 0
    ? "opponent"
    : result.healing > 0 || result.shield > 0
      ? "caster"
      : "field";
  const orbitalBonus = result.formula?.visual.orbitalChannelCount ?? 0;
  const channelBonus = result.formula?.channels.length ?? 0;
  const baseDuration = result.isSuccess ? 1480 : 920;

  return {
    spellHash,
    element,
    color: result.formula?.visual.elementColor ?? accent.glow,
    wash: accent.wash,
    secondaryColor: profile.secondaryColor,
    tertiaryColor: profile.tertiaryColor,
    motion,
    destinationLane,
    particleCount: Math.round(
      random.between(10, 18) + potency / 10 + orbitalBonus * 1.5 + (result.isSuccess ? 4 : 0),
    ),
    sparkCount: Math.round(random.between(4, 9) + channelBonus + (profile.sparkTrail ? 3 : 0)),
    ringCount: Math.round(random.between(2, 5) + Math.min(3, orbitalBonus)),
    rotation: random.between(-28, 28),
    intensity,
    particleKind: profile.particleKind,
    ringStyle: profile.ringStyle,
    bloomScale: profile.bloomScale * (intensity === "dramatic" ? 1.12 : 1),
    durationMs: Math.round(
      (baseDuration + intensityDurationBonus[intensity]) * profile.durationScale,
    ),
    impactStrength: profile.impactStrength * (result.isSuccess ? 1 : 0.45),
    isSuccess: result.isSuccess,
    precision: result.precision,
  };
};