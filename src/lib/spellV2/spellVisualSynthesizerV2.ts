import { getCatalogSigil } from "@/data/magicCatalogV2";
import type { MagicFormulaV2, SpellVisualV2, VisualRankV2 } from "@/types/magicFormulaV2";

const ELEMENT_COLORS: Record<string, { readonly color: string; readonly accent: string; readonly motif: string }> = {
  IGNIS: { color: "#e85d3e", accent: "#ffb15f", motif: "flame" },
  AQUA: { color: "#3b8dd4", accent: "#9bd8ff", motif: "ripple" },
  TERRA: { color: "#8b6f47", accent: "#d0b17a", motif: "stone" },
  VENTUS: { color: "#6fbf9f", accent: "#c8ffe2", motif: "gust" },
  LUX: { color: "#f0d060", accent: "#fff2a8", motif: "star" },
  UMBRA: { color: "#8f62c7", accent: "#c5a3ff", motif: "eclipse" },
  VITA: { color: "#44aa66", accent: "#a8f0b8", motif: "leaf" },
  GELU: { color: "#88d4ee", accent: "#dff8ff", motif: "crystal" },
  FULMEN: { color: "#e0d020", accent: "#fff56e", motif: "spark" },
  SANGUIS: { color: "#b64255", accent: "#ff99a8", motif: "thread" },
  MENS: { color: "#b789d6", accent: "#ead1ff", motif: "spiral_eye" },
};

const rankFromFormula = (formula: Pick<MagicFormulaV2, "validity" | "symmetry">): VisualRankV2 => {
  if (formula.validity === "invalid") return "fractured";
  if (formula.symmetry.overall >= 0.9) return "perfect";
  if (formula.symmetry.overall >= 0.76) return "symmetric";
  if (formula.symmetry.overall >= 0.52) return "stable";
  return "rough";
};

export const synthesizeSpellVisualV2 = (
  formula: Pick<MagicFormulaV2, "sigils" | "channels" | "symmetry" | "validity" | "castingCircle">,
): SpellVisualV2 => {
  const primarySigil = formula.sigils[0]?.sigilId;
  const catalogSigil = primarySigil ? getCatalogSigil(primarySigil) : undefined;
  const palette = primarySigil ? ELEMENT_COLORS[primarySigil] : undefined;
  const circleQuality = formula.castingCircle?.quality ?? 0;
  const rank = rankFromFormula(formula);
  const instability = Math.max(0, 1 - (formula.symmetry.overall * 0.55 + circleQuality * 0.45));

  return {
    elementColor: palette?.color ?? "#d8b56a",
    accentColor: palette?.accent ?? "#ffe6a6",
    motif: catalogSigil?.futureEffectHints.visualMotifs?.[0] ?? palette?.motif ?? "mandala",
    rank,
    glow: Number(Math.max(0.18, Math.min(1, formula.symmetry.overall * 0.72 + circleQuality * 0.35)).toFixed(3)),
    cleanliness: Number(Math.max(0, Math.min(1, formula.symmetry.strokeCleanliness)).toFixed(3)),
    orbitalChannelCount: formula.channels.filter((channel) => channel.geometry === "orbital_arc").length,
    instability: Number(instability.toFixed(3)),
  };
};
