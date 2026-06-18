import { motionDurations, type MotionIntensity } from "@/lib/ui/motionTokens";

export interface TurnPresentationTimings {
  readonly glyphReadDelay: number;
  readonly playerCastImpactDelay: number;
  readonly playerCastPhaseAdvanceDelay: number;
  readonly enemyTelegraphDelay: number;
  readonly enemyResultDelay: number;
  readonly defeatResultDelay: number;
  readonly resultFeedbackDuration: number;
}

export const readableTurnPresentationTimings: TurnPresentationTimings = {
  glyphReadDelay: 900,
  playerCastImpactDelay: 1100,
  playerCastPhaseAdvanceDelay: 3400,
  enemyTelegraphDelay: 900,
  enemyResultDelay: 4000,
  defeatResultDelay: 2600,
  resultFeedbackDuration: 4500,
};

const fastTurnPresentationTimings: TurnPresentationTimings = {
  glyphReadDelay: motionDurations.short,
  playerCastImpactDelay: motionDurations.castNormal,
  playerCastPhaseAdvanceDelay: 900,
  enemyTelegraphDelay: motionDurations.short,
  enemyResultDelay: 1200,
  defeatResultDelay: 900,
  resultFeedbackDuration: 1600,
};

const reducedMotionTurnPresentationTimings: TurnPresentationTimings = {
  glyphReadDelay: 700,
  playerCastImpactDelay: 900,
  playerCastPhaseAdvanceDelay: 3600,
  enemyTelegraphDelay: 700,
  enemyResultDelay: 4000,
  defeatResultDelay: 2600,
  resultFeedbackDuration: 4500,
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
  return readableTurnPresentationTimings;
};

export const turnPresentationTimings = getTurnPresentationTimings();

export const getCastIntensity = (potency: number): MotionIntensity => {
  if (potency >= 55) return "dramatic";
  if (potency >= 22) return "normal";
  return "quiet";
};
