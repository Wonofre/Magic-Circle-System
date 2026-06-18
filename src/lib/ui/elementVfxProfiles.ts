import type { ElementSigilId } from "@/types/magicFormulaV2";

export type ParticleKind = "spark" | "ember" | "droplet" | "wisp" | "shard" | "mote" | "arc";
export type RingStyle = "circle" | "hexagon" | "ripple" | "star";

export interface ElementVfxProfile {
  readonly particleKind: ParticleKind;
  readonly secondaryColor: string;
  readonly tertiaryColor: string;
  readonly bloomScale: number;
  readonly ringStyle: RingStyle;
  readonly sparkTrail: boolean;
  readonly durationScale: number;
  readonly impactStrength: number;
}

const neutralProfile: ElementVfxProfile = {
  particleKind: "mote",
  secondaryColor: "#e8c86a",
  tertiaryColor: "#c9a227",
  bloomScale: 1,
  ringStyle: "circle",
  sparkTrail: false,
  durationScale: 1,
  impactStrength: 0.7,
};

export const elementVfxProfiles: Record<ElementSigilId | "neutral", ElementVfxProfile> = {
  neutral: neutralProfile,
  IGNIS: {
    particleKind: "ember",
    secondaryColor: "#ff6b35",
    tertiaryColor: "#7f2412",
    bloomScale: 1.15,
    ringStyle: "star",
    sparkTrail: true,
    durationScale: 0.92,
    impactStrength: 1.1,
  },
  AQUA: {
    particleKind: "droplet",
    secondaryColor: "#66ccff",
    tertiaryColor: "#143f6e",
    bloomScale: 1.05,
    ringStyle: "ripple",
    sparkTrail: false,
    durationScale: 1.08,
    impactStrength: 0.85,
  },
  TERRA: {
    particleKind: "shard",
    secondaryColor: "#c4a574",
    tertiaryColor: "#5a4122",
    bloomScale: 0.95,
    ringStyle: "hexagon",
    sparkTrail: false,
    durationScale: 1.12,
    impactStrength: 0.9,
  },
  VENTUS: {
    particleKind: "wisp",
    secondaryColor: "#a8e6c8",
    tertiaryColor: "#246247",
    bloomScale: 1.1,
    ringStyle: "circle",
    sparkTrail: true,
    durationScale: 0.88,
    impactStrength: 0.75,
  },
  LUX: {
    particleKind: "spark",
    secondaryColor: "#fff0a0",
    tertiaryColor: "#866a11",
    bloomScale: 1.25,
    ringStyle: "star",
    sparkTrail: true,
    durationScale: 0.85,
    impactStrength: 1,
  },
  UMBRA: {
    particleKind: "wisp",
    secondaryColor: "#c49bff",
    tertiaryColor: "#432060",
    bloomScale: 1.05,
    ringStyle: "circle",
    sparkTrail: false,
    durationScale: 1.15,
    impactStrength: 0.8,
  },
  VITA: {
    particleKind: "mote",
    secondaryColor: "#7dff9a",
    tertiaryColor: "#206a32",
    bloomScale: 1.1,
    ringStyle: "ripple",
    sparkTrail: false,
    durationScale: 1.05,
    impactStrength: 0.7,
  },
  GELU: {
    particleKind: "shard",
    secondaryColor: "#b8ecff",
    tertiaryColor: "#28677d",
    bloomScale: 1,
    ringStyle: "hexagon",
    sparkTrail: false,
    durationScale: 1.1,
    impactStrength: 0.85,
  },
  FULMEN: {
    particleKind: "arc",
    secondaryColor: "#ffff66",
    tertiaryColor: "#786d07",
    bloomScale: 1.2,
    ringStyle: "star",
    sparkTrail: true,
    durationScale: 0.78,
    impactStrength: 1.15,
  },
  SANGUIS: {
    particleKind: "droplet",
    secondaryColor: "#ff6b82",
    tertiaryColor: "#6d1f2b",
    bloomScale: 1.05,
    ringStyle: "circle",
    sparkTrail: false,
    durationScale: 1,
    impactStrength: 0.95,
  },
  MENS: {
    particleKind: "wisp",
    secondaryColor: "#dfbaff",
    tertiaryColor: "#59316d",
    bloomScale: 1.08,
    ringStyle: "ripple",
    sparkTrail: true,
    durationScale: 1.12,
    impactStrength: 0.75,
  },
};

export const getElementVfxProfile = (element: ElementSigilId | "neutral"): ElementVfxProfile =>
  elementVfxProfiles[element] ?? neutralProfile;