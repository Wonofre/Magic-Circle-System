export const motionDurations = {
  instant: 90,
  micro: 140,
  short: 220,
  medium: 360,
  castNormal: 620,
  castHeavy: 920,
  boardSettle: 260,
} as const;

export const motionEasing = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  emphasized: "cubic-bezier(0.18, 0.84, 0.22, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

export type MotionIntensity = "quiet" | "normal" | "dramatic";
