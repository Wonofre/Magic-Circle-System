import { motionDurations, type MotionIntensity } from "@/lib/ui/motionTokens";

export interface TurnPresentationTimings {
  readonly glyphReadDelay: number;
  readonly playerCastImpactDelay: number;
  readonly playerCastPhaseAdvanceDelay: number;
  readonly enemyTelegraphDelay: number;
  readonly enemyResultDelay: number;
  readonly defeatResultDelay: number;
}

const defaultTurnPresentationTimings: TurnPresentationTimings = {
  glyphReadDelay: motionDurations.medium,
  playerCastImpactDelay: 980,
  playerCastPhaseAdvanceDelay: 420,
  enemyTelegraphDelay: 360,
  enemyResultDelay: 880,
  defeatResultDelay: 700,
};

const fastTurnPresentationTimings: TurnPresentationTimings = {
  glyphReadDelay: motionDurations.short,
  playerCastImpactDelay: motionDurations.castNormal,
  playerCastPhaseAdvanceDelay: motionDurations.short,
  enemyTelegraphDelay: motionDurations.short,
  enemyResultDelay: motionDurations.castNormal,
  defeatResultDelay: motionDurations.medium,
};

const reducedMotionTurnPresentationTimings: TurnPresentationTimings = {
  glyphReadDelay: motionDurations.micro,
  playerCastImpactDelay: motionDurations.medium,
  playerCastPhaseAdvanceDelay: motionDurations.micro,
  enemyTelegraphDelay: motionDurations.micro,
  enemyResultDelay: motionDurations.medium,
  defeatResultDelay: motionDurations.medium,
};

const isFastCombatRequested = (): boolean => {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  return params.get("fastCombat") === "1" ||
    params.get("skipMotion") === "1" ||
    window.localStorage.getItem("fastCombat") === "1";
};

const isReducedMotionRequested = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export const getTurnPresentationTimings = (): TurnPresentationTimings => {
  if (isFastCombatRequested()) return fastTurnPresentationTimings;
  if (isReducedMotionRequested()) return reducedMotionTurnPresentationTimings;
  return defaultTurnPresentationTimings;
};

export const turnPresentationTimings = getTurnPresentationTimings();

export const getCastIntensity = (potency: number): MotionIntensity => {
  if (potency >= 55) return "dramatic";
  if (potency >= 22) return "normal";
  return "quiet";
};
