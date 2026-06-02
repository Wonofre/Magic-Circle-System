import type { CastResult } from "@/lib/spellEngine";
import type { SigilType } from "@/types/magic";
import type { MotionIntensity } from "@/lib/ui/motionTokens";
import { elementalAccent } from "@/lib/ui/themeTokens";
import { createSpellVfxRandom } from "@/lib/ui/spellVfxSeed";
import { getCastIntensity } from "@/lib/ui/turnPresentationDirector";

export interface SpellVfxRecipe {
  readonly spellHash: string;
  readonly element: SigilType | "neutral";
  readonly color: string;
  readonly wash: string;
  readonly motion: "strike" | "mend" | "ward" | "fizzle";
  readonly targetLane: "enemy" | "self" | "field";
  readonly particleCount: number;
  readonly ringCount: number;
  readonly rotation: number;
  readonly intensity: MotionIntensity;
}

type VfxCastResult = CastResult & { readonly spellHash?: string };

export const createSpellVfxRecipe = (result: VfxCastResult): SpellVfxRecipe => {
  const spellHash = result.spellHash ?? `${result.spellName}-${result.primarySigil ?? "neutral"}`;
  const random = createSpellVfxRandom(spellHash);
  const element = result.primarySigil ?? "neutral";
  const accent = element === "neutral"
    ? { glow: "#f2d27b", wash: "rgba(242, 210, 123, 0.16)" }
    : elementalAccent[element];
  const potency = Math.max(result.damage, result.healing, result.shield, result.precision);
  const motion = !result.isSuccess
    ? "fizzle"
    : result.healing > 0
    ? "mend"
    : result.shield > 0
    ? "ward"
    : "strike";
  const targetLane = result.damage > 0
    ? "enemy"
    : result.healing > 0 || result.shield > 0
    ? "self"
    : "field";

  return {
    spellHash,
    element,
    color: accent.glow,
    wash: accent.wash,
    motion,
    targetLane,
    particleCount: Math.round(random.between(7, 15) + potency / 12),
    ringCount: Math.round(random.between(2, 4)),
    rotation: random.between(-22, 22),
    intensity: getCastIntensity(potency),
  };
};
