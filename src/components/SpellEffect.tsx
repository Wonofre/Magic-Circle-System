import { useEffect, useState } from "react";
import type { CastResult } from "@/lib/spellEngine";
import { motionDurations } from "@/lib/ui/motionTokens";
import { turnPresentationTimings } from "@/lib/ui/turnPresentationDirector";
import { createSpellVfxRecipe } from "@/lib/ui/spellVfxRecipes";
import { getElementBurstTexture, vfxSharedTextures } from "@/lib/ui/vfxAssets";
import { Zap, Shield, Heart, Crosshair, Sparkles, TrendingUp, AlertTriangle, X } from "lucide-react";
import type { ElementSigilId } from "@/types/magicFormulaV2";

interface SpellEffectProps {
  result: CastResult | null;
}

const elementColors: Record<ElementSigilId, { bg: string; border: string; text: string; glow: string; accent: string }> = {
  IGNIS: { bg: "rgba(50,14,6,0.94)", border: "rgba(232,93,62,0.55)", text: "#ffb088", glow: "#e85d3e", accent: "#ff6b35" },
  AQUA: { bg: "rgba(8,28,58,0.94)", border: "rgba(59,141,212,0.55)", text: "#88ccff", glow: "#3b8dd4", accent: "#66ccff" },
  TERRA: { bg: "rgba(32,20,8,0.94)", border: "rgba(139,111,71,0.55)", text: "#e8c896", glow: "#8b6f47", accent: "#c4a574" },
  VENTUS: { bg: "rgba(8,36,24,0.94)", border: "rgba(126,200,160,0.55)", text: "#a8f0c8", glow: "#7ec8a0", accent: "#a8e6c8" },
  LUX: { bg: "rgba(48,36,4,0.94)", border: "rgba(240,208,96,0.55)", text: "#fff0a0", glow: "#f0d060", accent: "#ffe066" },
  UMBRA: { bg: "rgba(20,6,38,0.94)", border: "rgba(155,107,204,0.55)", text: "#d4a8ff", glow: "#9b6bcc", accent: "#c49bff" },
  VITA: { bg: "rgba(6,32,14,0.94)", border: "rgba(68,204,102,0.55)", text: "#88ffaa", glow: "#44cc66", accent: "#7dff9a" },
  GELU: { bg: "rgba(4,24,42,0.94)", border: "rgba(136,212,238,0.55)", text: "#b8ecff", glow: "#88d4ee", accent: "#aaeeff" },
  FULMEN: { bg: "rgba(42,38,4,0.94)", border: "rgba(224,208,32,0.55)", text: "#ffff88", glow: "#e0d020", accent: "#ffff55" },
  SANGUIS: { bg: "rgba(42,6,14,0.94)", border: "rgba(182,66,85,0.55)", text: "#ff99aa", glow: "#b64255", accent: "#ff6b82" },
  MENS: { bg: "rgba(28,10,42,0.94)", border: "rgba(183,137,214,0.55)", text: "#e8c8ff", glow: "#b789d6", accent: "#dfbaff" },
};

const failColors = {
  bg: "rgba(14,8,10,0.96)",
  border: "rgba(139,46,58,0.5)",
  text: "#ff9999",
  glow: "#8b2e3a",
  accent: "#cc4444",
};

const primaryElement = (result: CastResult): ElementSigilId | undefined =>
  result.effects[0]?.element ?? result.formula?.sigils[0]?.sigilId;

export function SpellEffectDisplay({ result }: SpellEffectProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!result) return;
    const tReset = setTimeout(() => setDismissed(false), 0);
    const t0 = setTimeout(() => setVisible(true), 80);
    const t1 = setTimeout(
      () => setVisible(false),
      turnPresentationTimings.resultFeedbackDuration,
    );

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(tReset);
    };
  }, [result]);

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
  };

  if (!result || dismissed) return null;

  const element = primaryElement(result);
  const colors = result.isSuccess && element ? elementColors[element] : failColors;
  const recipe = createSpellVfxRecipe(result);
  const burstTexture = result.isSuccess && element
    ? getElementBurstTexture(element)
    : vfxSharedTextures.fizzleBurst;
  const hasDamage = result.damage > 0;
  const hasHeal = result.healing > 0;
  const hasShield = result.shield > 0;
  const hasStatus = result.statusEffects.length > 0;
  const hasField = Boolean(result.fieldEffect);
  const isSuper = result.elementalMultiplier > 1.5;
  const isResisted = result.elementalMultiplier < 0.8 && result.elementalMultiplier > 0;

  return (
    <div
      className="spell-effect-toast fixed left-1/2 top-16 z-50"
      role="status"
      aria-live="polite"
      style={{
        transform: visible
          ? "translateX(-50%) translateY(0) scale(1)"
          : "translateX(-50%) translateY(-20px) scale(0.94)",
        opacity: visible ? 1 : 0,
        transition: `transform ${motionDurations.short}ms cubic-bezier(0.18, 0.84, 0.22, 1), opacity ${motionDurations.short}ms ease`,
        maxWidth: "380px",
        width: "calc(100vw - 2rem)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div
        className={`spell-effect-panel relative overflow-hidden rounded-md ${result.isSuccess ? "spell-effect-success" : "spell-effect-failure"}`}
        style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          boxShadow: `0 0 32px ${colors.glow}33, 0 12px 40px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}
      >
        <div
          className="spell-effect-glow-bar h-1 w-full"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${colors.accent} 30%, ${colors.glow} 50%, ${colors.accent} 70%, transparent 100%)` }}
        />

        <div
          className="spell-effect-texture pointer-events-none absolute -right-6 -top-6 h-28 w-28 opacity-[0.22]"
          style={{
            backgroundImage: `url(${burstTexture})`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            mixBlendMode: "screen",
          }}
          aria-hidden="true"
        />

        <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, ${colors.glow}, transparent 50%), radial-gradient(circle at 80% 50%, ${colors.accent}, transparent 50%)`,
          }}
        />

        <div className="relative p-4 pb-3">
          <p className="mb-2 font-display text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: `${colors.text}88` }}>
            {result.isSuccess ? "Selo ativado" : "Fórmula instável"}
          </p>

          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              {result.isSuccess ? (
                <Sparkles className="h-4 w-4 flex-shrink-0 animate-pulse-glow" style={{ color: colors.accent }} />
              ) : (
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
              )}
              <span className="font-display text-base font-bold leading-tight tracking-wide" style={{ color: colors.text }}>
                {result.spellName}
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 rounded p-0.5 opacity-50 transition-opacity hover:opacity-100"
              style={{ color: colors.text, pointerEvents: "auto" }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {result.isSuccess && (hasDamage || hasHeal || hasShield) && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {hasDamage && (
                <div className="spell-effect-stat flex items-center gap-1 rounded border border-red-800/40 bg-red-950/40 px-2 py-0.5">
                  <Zap className="h-3 w-3 text-red-400" />
                  <span className="font-mono text-lg font-bold leading-none text-red-300">{result.damage}</span>
                  <span className="text-[9px] uppercase tracking-wider text-red-500/70">dano</span>
                </div>
              )}
              {hasHeal && (
                <div className="spell-effect-stat flex items-center gap-1 rounded border border-emerald-800/40 bg-emerald-950/40 px-2 py-0.5">
                  <Heart className="h-3 w-3 text-emerald-400" />
                  <span className="font-mono text-lg font-bold leading-none text-emerald-300">{result.healing}</span>
                  <span className="text-[9px] uppercase tracking-wider text-emerald-500/70">cura</span>
                </div>
              )}
              {hasShield && (
                <div className="spell-effect-stat flex items-center gap-1 rounded border border-sky-800/40 bg-sky-950/40 px-2 py-0.5">
                  <Shield className="h-3 w-3 text-sky-400" />
                  <span className="font-mono text-lg font-bold leading-none text-sky-300">{result.shield}</span>
                  <span className="text-[9px] uppercase tracking-wider text-sky-500/70">escudo</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-mono"
              style={{
                background: result.precision >= 75 ? "rgba(20,80,20,0.45)" : result.precision >= 50 ? "rgba(80,60,0,0.45)" : "rgba(80,20,20,0.45)",
                color: result.precision >= 75 ? "#88ee88" : result.precision >= 50 ? "#ddaa44" : "#ff7777",
                border: `1px solid ${result.precision >= 75 ? "rgba(68,204,68,0.3)" : result.precision >= 50 ? "rgba(200,160,0,0.3)" : "rgba(200,60,60,0.3)"}`,
              }}
            >
              <Crosshair className="h-2.5 w-2.5" />
              {result.precision}%
            </span>
            {result.formula && (
              <span className="rounded-full border border-white/10 bg-black/35 px-1.5 py-0.5 text-[10px] uppercase tracking-wider" style={{ color: colors.text }}>
                {result.formula.visual.rank}
              </span>
            )}
            {hasStatus && (
              <span className="rounded-full border border-red-700/30 bg-red-950/45 px-1.5 py-0.5 text-[10px] text-red-200">
                {result.statusEffects.map((status) => status.type).join("/")}
              </span>
            )}
            {hasField && result.fieldEffect && (
              <span className="rounded-full border border-violet-700/30 bg-violet-950/45 px-1.5 py-0.5 text-[10px] text-violet-200">
                {result.fieldEffect.type}
              </span>
            )}
            {isSuper && (
              <span className="flex items-center gap-0.5 rounded-full border border-orange-700/40 bg-orange-950/55 px-1.5 py-0.5 text-[10px] text-orange-300">
                <TrendingUp className="h-2.5 w-2.5" />
                Super Efetivo
              </span>
            )}
            {isResisted && (
              <span className="rounded-full border border-blue-700/40 bg-blue-950/55 px-1.5 py-0.5 text-[10px] text-blue-300">
                Resistido
              </span>
            )}
            {recipe.intensity === "dramatic" && result.isSuccess && (
              <span className="rounded-full border border-amber-700/35 bg-amber-950/45 px-1.5 py-0.5 text-[10px] text-amber-200">
                conjuração intensa
              </span>
            )}
          </div>

          {result.feedback && (
            <p className="mt-2 text-sm italic leading-relaxed" style={{ color: `${colors.text}bb` }}>
              {result.feedback}
            </p>
          )}
        </div>

        <div className="h-0.5 bg-black/30">
          <div
            className="spell-effect-timer h-full"
            style={{
              background: `linear-gradient(90deg, ${colors.glow}, ${colors.accent})`,
              animation: visible
                ? `spell-effect-shrink ${turnPresentationTimings.resultFeedbackDuration}ms linear forwards`
                : "none",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes spell-effect-shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        .spell-effect-panel {
          animation: spell-effect-enter 0.38s cubic-bezier(0.18, 0.84, 0.22, 1) both;
        }
        @keyframes spell-effect-enter {
          from { opacity: 0; filter: blur(4px); }
          to { opacity: 1; filter: blur(0); }
        }
        .spell-effect-glow-bar {
          animation: spell-effect-bar-shimmer 2.4s ease-in-out infinite;
        }
        @keyframes spell-effect-bar-shimmer {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}