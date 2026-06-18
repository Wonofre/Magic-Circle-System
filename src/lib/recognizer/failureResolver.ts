import type { InkSimulationResult } from "@/types/ink";
import type {
  RecognitionOutcome,
  RecognitionStroke,
  SemanticMarginResult,
  TemplateMatchResult,
  TopologyValidationCheck,
  TopologyValidationResult,
} from "@/types/recognition";
import type { FormulaIssueV2 } from "@/types/magicFormulaV2";
import { getStrokePathLength } from "@/lib/recognizer/resampleStrokes";

export type DiegeticFailureKind =
  | "fizzle"
  | "miscast"
  | "leak"
  | "backfire"
  | "unknown"
  | "overload";

export type FailureSeverity = "minor" | "moderate" | "severe" | "critical";

export interface FailureSignalBreakdown {
  readonly geometry: number;
  readonly topology: number;
  readonly ambiguity: number;
  readonly dynamics: number;
  readonly ink: number;
  readonly total: number;
}

export interface StrokeDynamicMetrics {
  readonly timedSegmentCount: number;
  readonly averageSpeed: number;
  readonly maxSpeed: number;
  readonly speedVariance: number;
  readonly pressureVariance: number;
  readonly abruptMotionScore: number;
}

export interface DiegeticFailureEffect {
  readonly canDamageCaster: boolean;
  readonly casterDamageHint: number;
  readonly consumesInk: boolean;
  readonly unstableRoute: boolean;
}

export interface DiegeticFailureResolution {
  readonly kind: DiegeticFailureKind;
  readonly severity: FailureSeverity;
  readonly message: string;
  readonly technicalCause: string;
  readonly playerFeedback: string;
  readonly signals: FailureSignalBreakdown;
  readonly dynamicMetrics: StrokeDynamicMetrics | null;
  readonly effect: DiegeticFailureEffect;
}

export interface FailureResolverInput {
  readonly outcome?: RecognitionOutcome | "formula_invalid";
  readonly match?: TemplateMatchResult;
  readonly topology?: TopologyValidationResult;
  readonly semantic?: SemanticMarginResult;
  readonly formulaIssues?: readonly FormulaIssueV2[];
  readonly ink?: InkSimulationResult;
  readonly strokes?: readonly RecognitionStroke[];
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const getSeverity = (score: number): FailureSeverity => {
  if (score >= 0.78) return "critical";
  if (score >= 0.55) return "severe";
  if (score >= 0.32) return "moderate";
  return "minor";
};

const hasFailedCheck = (
  topology: TopologyValidationResult | undefined,
  ids: readonly string[],
): boolean =>
  topology?.checks.some((check) => check.status === "fail" && ids.includes(check.id)) ?? false;

const failedChecks = (
  topology: TopologyValidationResult | undefined,
): readonly TopologyValidationCheck[] =>
  topology?.checks.filter((check) => check.status === "fail") ?? [];

const getDynamicMetrics = (
  strokes: readonly RecognitionStroke[] | undefined,
): StrokeDynamicMetrics | null => {
  if (!strokes || strokes.length === 0) return null;

  const speeds: number[] = [];
  const pressures: number[] = [];

  strokes.forEach((stroke) => {
    stroke.points.forEach((point) => {
      if (typeof point.pressure === "number") {
        pressures.push(point.pressure);
      }
    });

    for (let index = 1; index < stroke.points.length; index += 1) {
      const previous = stroke.points[index - 1];
      const current = stroke.points[index];

      if (typeof previous.t !== "number" || typeof current.t !== "number") {
        continue;
      }

      const elapsed = Math.max(1, current.t - previous.t);
      const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
      speeds.push(distance / elapsed);
    }
  });

  if (speeds.length === 0) {
    return {
      timedSegmentCount: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      speedVariance: 0,
      pressureVariance: 0,
      abruptMotionScore: 0,
    };
  }

  const averageSpeed = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
  const maxSpeed = Math.max(...speeds);
  const speedVariance =
    speeds.reduce((sum, speed) => sum + (speed - averageSpeed) ** 2, 0) / speeds.length;
  const averagePressure =
    pressures.length === 0 ? 0 : pressures.reduce((sum, pressure) => sum + pressure, 0) / pressures.length;
  const pressureVariance =
    pressures.length === 0
      ? 0
      : pressures.reduce((sum, pressure) => sum + (pressure - averagePressure) ** 2, 0) /
        pressures.length;

  return {
    timedSegmentCount: speeds.length,
    averageSpeed,
    maxSpeed,
    speedVariance,
    pressureVariance,
    abruptMotionScore: clamp01(maxSpeed / Math.max(0.001, averageSpeed * 6) + speedVariance * 0.2),
  };
};

const getGeometrySignal = (input: FailureResolverInput): number => {
  const confidence = input.semantic?.confidence ?? input.match?.topCandidate?.confidence ?? 0;
  const candidate = input.match?.topCandidate;
  const meanDistancePenalty = candidate ? clamp01(candidate.meanDistance / 24) : 0.4;
  const scribblePenalty = input.match?.scribble.score ?? 0;

  return clamp01((1 - confidence) * 0.55 + meanDistancePenalty * 0.25 + scribblePenalty * 0.2);
};

const getTopologySignal = (topology: TopologyValidationResult | undefined): number => {
  if (!topology) return 0;

  const checks = topology.checks.length;
  if (checks === 0) return 0;

  const failed = failedChecks(topology);
  const criticalBonus = hasFailedCheck(topology, ["loops", "open_strokes", "closure_required"])
    ? 0.25
    : 0;

  return clamp01(failed.length / checks + criticalBonus);
};

const getAmbiguitySignal = (input: FailureResolverInput): number => {
  const margin = input.semantic?.semanticMargin ?? input.match?.semanticMargin ?? 0;
  const minMargin = input.semantic?.minSemanticMargin ?? input.match?.topCandidate?.template.recognition.min_semantic_margin ?? 0.12;

  if (minMargin <= 0) return 0;
  return clamp01(1 - margin / minMargin);
};

const getDynamicsSignal = (
  strokes: readonly RecognitionStroke[] | undefined,
  metrics: StrokeDynamicMetrics | null,
): number => {
  if (!strokes || strokes.length === 0 || !metrics) return 0;

  const totalLength = strokes.reduce((sum, stroke) => sum + getStrokePathLength(stroke.points), 0);
  const franticLength = clamp01(totalLength / 900);

  return clamp01(metrics.abruptMotionScore * 0.65 + franticLength * 0.2 + metrics.pressureVariance * 0.15);
};

const getInkSignal = (ink: InkSimulationResult | undefined): number => {
  if (!ink) return 0;
  if (!ink.ok) return 1;

  return clamp01(ink.overloadChance);
};

const buildSignals = (
  input: FailureResolverInput,
  dynamicMetrics: StrokeDynamicMetrics | null,
): FailureSignalBreakdown => {
  const geometry = getGeometrySignal(input);
  const topology = getTopologySignal(input.topology);
  const ambiguity = getAmbiguitySignal(input);
  const dynamics = getDynamicsSignal(input.strokes, dynamicMetrics);
  const ink = getInkSignal(input.ink);
  const total = clamp01(
    geometry * 0.25 + topology * 0.25 + ambiguity * 0.2 + dynamics * 0.1 + ink * 0.2,
  );

  return { geometry, topology, ambiguity, dynamics, ink, total };
};

const isUnknownInput = (input: FailureResolverInput): boolean =>
  input.match?.rejectionReason === "unknown" ||
  input.match?.scribble.outcome === "unknown";

const chooseFailureKind = (
  input: FailureResolverInput,
  signals: FailureSignalBreakdown,
): DiegeticFailureKind => {
  if (input.ink?.failureCode === "overload_risk" || (input.ink?.ok && input.ink.overloadChance >= 0.72)) {
    return "overload";
  }

  if (input.ink && !input.ink.ok) {
    return "fizzle";
  }

  if (input.outcome === "backfire") {
    return "backfire";
  }

  if (isUnknownInput(input)) {
    return "unknown";
  }

  if (
    input.outcome === "partial" ||
    input.outcome === "cast_weak" ||
    hasFailedCheck(input.topology, ["noise", "ports"])
  ) {
    return "leak";
  }

  if (input.outcome === "miscast" || signals.ambiguity >= 0.55 || signals.topology >= 0.45) {
    return "miscast";
  }

  return "fizzle";
};

const getPrimaryTechnicalCause = (
  input: FailureResolverInput,
  kind: DiegeticFailureKind,
): string => {
  if (input.ink && !input.ink.ok) return input.ink.message ?? "Ink reservoir could not pay the spell cost.";
  if (kind === "overload") return "Ink volatility and spell risk exceeded the safe overload threshold.";

  const failed = failedChecks(input.topology);
  if (failed.length > 0) {
    return failed.map((check) => check.message).join(" ");
  }

  const semanticFailure = input.semantic?.reasons.find((reason) => reason.severity === "failure");
  if (semanticFailure) return semanticFailure.message;

  const formulaIssue = input.formulaIssues?.[0];
  if (formulaIssue) return formulaIssue.message;

  return "The drawing did not satisfy the deterministic recognition grammar.";
};

const formulaIssueFeedback = (issue: FormulaIssueV2 | undefined): string | null => {
  switch (issue?.code) {
    case "missing_casting_circle":
      return "Trace um circulo grande ao redor de toda a formula.";
    case "casting_circle_open":
      return "Feche a abertura do circulo externo, terminando o traco perto de onde comecou.";
    case "missing_central_sigil":
      return "Desenhe um sigilo de elemento no centro do circulo.";
    case "channel_crosses_casting_circle":
      return "Mantenha todos os canais dentro do circulo externo.";
    case "straight_key_channel":
      return "Refaca a ligacao entre as chaves com uma curva suave.";
    default:
      return null;
  }
};

const getMessages = (
  kind: DiegeticFailureKind,
  severity: FailureSeverity,
  input: FailureResolverInput,
): Pick<DiegeticFailureResolution, "message" | "playerFeedback"> => {
  const intensity = severity === "critical" || severity === "severe" ? "forte" : "leve";
  const issueFeedback = formulaIssueFeedback(input.formulaIssues?.[0]);

  switch (kind) {
    case "backfire":
      return {
        message: "O circuito fechou contra a mao da conjuradora.",
        playerFeedback: `O retorno foi ${intensity}. Apague tracos que se cruzam e mantenha as ligacoes dentro do circulo externo.`,
      };
    case "miscast":
      return {
        message: "A intencao ficou ambigua e a magia desviou de forma.",
        playerFeedback: "Um simbolo ficou parecido com outro. Reforce suas pontas, curvas e marcas internas antes de conjurar novamente.",
      };
    case "leak":
      return {
        message: "A tinta vazou por uma conexao fraca antes de virar feitico.",
        playerFeedback: "Feche os contornos e refaca ligacoes interrompidas ou que ultrapassam o circulo externo.",
      };
    case "unknown":
      return {
        message: "O circulo nao reconheceu um dos simbolos.",
        playerFeedback: "Compare o simbolo com o Guia e redesenhe-o com um contorno limpo, sem fragmentos soltos.",
      };
    case "overload":
      return {
        message: "A tinta entrou em sobrecarga e saturou o circuito.",
        playerFeedback: "Simplifique a formula: remova uma chave ou ligacao antes de tentar novamente.",
      };
    case "fizzle":
    default:
      return {
        message: "A centelha apagou antes da magia nascer.",
        playerFeedback: issueFeedback ?? "Confira se o circulo esta fechado, se ha um sigilo no centro e se as chaves estao ligadas.",
      };
  }
};

const getEffect = (
  kind: DiegeticFailureKind,
  severity: FailureSeverity,
  ink: InkSimulationResult | undefined,
): DiegeticFailureEffect => {
  const severityDamage = severity === "critical" ? 10 : severity === "severe" ? 6 : severity === "moderate" ? 3 : 1;

  return {
    canDamageCaster: kind === "backfire" || kind === "overload",
    casterDamageHint: kind === "backfire" || kind === "overload" ? severityDamage : 0,
    consumesInk:
      (kind === "leak" || kind === "miscast" || kind === "overload") &&
      ink?.failureCode !== "insufficient_ink",
    unstableRoute: kind === "miscast",
  };
};

export const resolveDiegeticFailure = (
  input: FailureResolverInput,
): DiegeticFailureResolution => {
  const dynamicMetrics = getDynamicMetrics(input.strokes);
  const signals = buildSignals(input, dynamicMetrics);
  const kind = chooseFailureKind(input, signals);
  const severity = getSeverity(signals.total);
  const messages = getMessages(kind, severity, input);

  return {
    kind,
    severity,
    ...messages,
    technicalCause: getPrimaryTechnicalCause(input, kind),
    signals,
    dynamicMetrics,
    effect: getEffect(kind, severity, input.ink),
  };
};
