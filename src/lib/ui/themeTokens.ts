import type { SigilType } from "@/types/magic";

export const grimoireTheme = {
  paper: "#d8bc83",
  paperDeep: "#b88646",
  paperInk: "#332115",
  table: "#12080b",
  wine: "#35111a",
  wineDeep: "#19090d",
  gold: "#d7a63f",
  goldBright: "#f2d27b",
  soot: "#090506",
  shadow: "rgba(20, 8, 10, 0.64)",
} as const;

export const elementalAccent: Record<SigilType, { name: string; glow: string; ink: string; wash: string }> = {
  fire: { name: "Ignis", glow: "#e85d3e", ink: "#7f2412", wash: "rgba(232, 93, 62, 0.18)" },
  water: { name: "Aqua", glow: "#3b8dd4", ink: "#143f6e", wash: "rgba(59, 141, 212, 0.18)" },
  earth: { name: "Terra", glow: "#8b6f47", ink: "#5a4122", wash: "rgba(139, 111, 71, 0.2)" },
  wind: { name: "Ventus", glow: "#7ec8a0", ink: "#246247", wash: "rgba(126, 200, 160, 0.16)" },
  light: { name: "Lux", glow: "#f0d060", ink: "#866a11", wash: "rgba(240, 208, 96, 0.18)" },
  ice: { name: "Gelu", glow: "#88d4ee", ink: "#28677d", wash: "rgba(136, 212, 238, 0.16)" },
  shadow: { name: "Umbra", glow: "#9b6bcc", ink: "#432060", wash: "rgba(155, 107, 204, 0.18)" },
  thunder: { name: "Fulmen", glow: "#e0d020", ink: "#786d07", wash: "rgba(224, 208, 32, 0.16)" },
  nature: { name: "Vita", glow: "#44cc66", ink: "#206a32", wash: "rgba(68, 204, 102, 0.16)" },
  void: { name: "Vacuus", glow: "#8866aa", ink: "#34224f", wash: "rgba(136, 102, 170, 0.2)" },
};

export const paperSurfaceBackground = [
  "radial-gradient(circle at 18% 18%, rgba(255,255,255,0.18), transparent 24%)",
  "radial-gradient(circle at 76% 78%, rgba(92,49,20,0.18), transparent 30%)",
  "linear-gradient(115deg, rgba(255,255,255,0.12), transparent 35%, rgba(80,37,13,0.16))",
  `linear-gradient(180deg, ${grimoireTheme.paper}, #c99e62 58%, ${grimoireTheme.paperDeep})`,
].join(", ");

