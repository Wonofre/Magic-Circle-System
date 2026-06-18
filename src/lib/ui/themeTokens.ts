import type { ElementSigilId } from "@/types/magicFormulaV2";

export const grimoireTheme = {
  paper: "#e8d4a8",
  paperDeep: "#c9a86c",
  paperInk: "#2a1810",
  table: "#0d0608",
  wine: "#2a1018",
  wineDeep: "#14080c",
  gold: "#c9a227",
  goldBright: "#e8c86a",
  inkCobalt: "#1a4a6b",
  inkGlow: "#2d6a8f",
  soot: "#060304",
  shadow: "rgba(12, 4, 6, 0.72)",
  candle: "rgba(232, 200, 106, 0.35)",
} as const;

export const elementalAccent: Record<ElementSigilId, { name: string; glow: string; ink: string; wash: string }> = {
  IGNIS: { name: "Ignis", glow: "#e85d3e", ink: "#7f2412", wash: "rgba(232, 93, 62, 0.18)" },
  AQUA: { name: "Aqua", glow: "#3b8dd4", ink: "#143f6e", wash: "rgba(59, 141, 212, 0.18)" },
  TERRA: { name: "Terra", glow: "#8b6f47", ink: "#5a4122", wash: "rgba(139, 111, 71, 0.2)" },
  VENTUS: { name: "Ventus", glow: "#7ec8a0", ink: "#246247", wash: "rgba(126, 200, 160, 0.16)" },
  LUX: { name: "Lux", glow: "#f0d060", ink: "#866a11", wash: "rgba(240, 208, 96, 0.18)" },
  UMBRA: { name: "Umbra", glow: "#9b6bcc", ink: "#432060", wash: "rgba(155, 107, 204, 0.18)" },
  VITA: { name: "Vita", glow: "#44cc66", ink: "#206a32", wash: "rgba(68, 204, 102, 0.16)" },
  GELU: { name: "Gelu", glow: "#88d4ee", ink: "#28677d", wash: "rgba(136, 212, 238, 0.16)" },
  FULMEN: { name: "Fulmen", glow: "#e0d020", ink: "#786d07", wash: "rgba(224, 208, 32, 0.16)" },
  SANGUIS: { name: "Sanguis", glow: "#b64255", ink: "#6d1f2b", wash: "rgba(182, 66, 85, 0.16)" },
  MENS: { name: "Mens", glow: "#b789d6", ink: "#59316d", wash: "rgba(183, 137, 214, 0.16)" },
};

export const paperSurfaceBackground = [
  "url(/assets/parchment-texture.jpg)",
  "radial-gradient(circle at 18% 18%, rgba(255,255,255,0.22), transparent 28%)",
  "radial-gradient(circle at 76% 78%, rgba(92,49,20,0.14), transparent 34%)",
  "linear-gradient(115deg, rgba(255,255,255,0.1), transparent 38%, rgba(80,37,13,0.12))",
  `linear-gradient(180deg, ${grimoireTheme.paper}, #d4b87a 58%, ${grimoireTheme.paperDeep})`,
].join(", ");

export const workshopBackground = [
  "url(/assets/workshop-background.jpg)",
  "radial-gradient(ellipse at 50% 40%, transparent 0%, rgba(6,3,4,0.55) 72%)",
  `linear-gradient(180deg, rgba(13,6,8,0.3) 0%, ${grimoireTheme.table} 100%)`,
].join(", ");