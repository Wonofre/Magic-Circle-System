import type {
  RecognitionOutcome,
  SemanticDecisionReason,
  SemanticMarginOptions,
  SemanticMarginResult,
  SemanticRiskLevel,
  TemplateMatchCandidate,
  TemplateMatchResult,
  TopologyValidationResult,
} from "@/types/recognition";
import type { GlyphSemanticRole } from "@/types/glyphTemplates";

const DEFAULT_SEVERE_CONFIDENCE_GAP = 0.2;
const DEFAULT_WEAK_TOPOLOGY_OUTCOME: RecognitionOutcome = "cast_weak";
const CRITICAL_TOPOLOGY_CHECKS = new Set([
  "loops",
  "open_strokes",
  "closure_required",
  "corners_min",
  "turns_min",
  "exit_marker",
]);
const HIGH_RISK_ROLES: readonly GlyphSemanticRole[] = [
  "risk",
  "ink",
  "element",
  "derived",
  "action",
];
const MEDIUM_RISK_ROLES: readonly GlyphSemanticRole[] = [
  "defense",
  "time",
  "form",
];

const makeReason = (
  code: string,
  message: string,
  severity: SemanticDecisionReason["severity"],
): SemanticDecisionReason => ({
  code,
  message,
  severity,
});

const getRiskLevel = (candidate: TemplateMatchCandidate | null): SemanticRiskLevel => {
  if (!candidate) {
    return "low";
  }

  const role = candidate.template.semantic_role;

  if (HIGH_RISK_ROLES.includes(role)) {
    return "high";
  }

  if (MEDIUM_RISK_ROLES.includes(role)) {
    return "medium";
  }

  return "low";
};

const hasCriticalTopologyFailure = (topology: TopologyValidationResult): boolean =>
  topology.checks.some(
    (check) => check.status === "fail" && CRITICAL_TOPOLOGY_CHECKS.has(check.id),
  );

const getTopologyReasons = (
  topology: TopologyValidationResult | null,
): SemanticDecisionReason[] => {
  if (!topology) {
    return [];
  }

  return topology.checks
    .filter((check) => check.status !== "pass")
    .map((check) =>
      makeReason(
        `topology_${check.id}`,
        check.message,
        check.status === "fail" ? "failure" : "warning",
      ),
    );
};

const buildResult = (
  outcome: RecognitionOutcome,
  matchResult: TemplateMatchResult,
  candidate: TemplateMatchCandidate | null,
  topology: TopologyValidationResult | null,
  reasons: readonly SemanticDecisionReason[],
  options: SemanticMarginOptions,
): SemanticMarginResult => {
  const minConfidence =
    options.confidenceThreshold ??
    candidate?.template.recognition.min_confidence ??
    0;
  const minSemanticMargin =
    options.semanticMarginThreshold ??
    candidate?.template.recognition.min_semantic_margin ??
    0;

  return {
    outcome,
    candidate,
    riskLevel: getRiskLevel(candidate),
    confidence: candidate?.confidence ?? 0,
    minConfidence,
    semanticMargin: matchResult.semanticMargin,
    minSemanticMargin,
    topologyValid: topology ? topology.isValid : null,
    reasons,
  };
};

export const evaluateSemanticMargin = (
  matchResult: TemplateMatchResult,
  topologyResult?: TopologyValidationResult,
  options: SemanticMarginOptions = {},
): SemanticMarginResult => {
  const severeConfidenceGap =
    options.severeConfidenceGap ?? DEFAULT_SEVERE_CONFIDENCE_GAP;
  const weakTopologyOutcome =
    options.weakTopologyOutcome ?? DEFAULT_WEAK_TOPOLOGY_OUTCOME;
  const topology = topologyResult ?? null;
  const candidate = matchResult.topCandidate;
  const baseReasons: SemanticDecisionReason[] = [];

  if (matchResult.inputRejected) {
    baseReasons.push(
      makeReason(
        "input_rejected",
        `Input rejected before semantic decision: ${matchResult.rejectionReason ?? "unknown"}.`,
        "failure",
      ),
    );
    return buildResult("fizzle", matchResult, candidate, topology, baseReasons, options);
  }

  if (!candidate) {
    baseReasons.push(
      makeReason("missing_candidate", "No template candidate was available.", "failure"),
    );
    return buildResult("fizzle", matchResult, candidate, topology, baseReasons, options);
  }

  const riskLevel = getRiskLevel(candidate);
  const minConfidence =
    options.confidenceThreshold ??
    candidate.template.recognition.min_confidence;
  const minSemanticMargin =
    options.semanticMarginThreshold ??
    candidate.template.recognition.min_semantic_margin;
  const confidence = candidate.confidence;
  const severeConfidenceThreshold = Math.max(0, minConfidence - severeConfidenceGap);
  const topologyReasons = getTopologyReasons(topology);

  baseReasons.push(
    makeReason(
      "candidate_ranked",
      `Top candidate ${candidate.template.id} ranked with confidence ${confidence.toFixed(3)}.`,
      "info",
    ),
  );

  if (topology && !topology.isValid && hasCriticalTopologyFailure(topology)) {
    const outcome = riskLevel === "high" ? "backfire" : "miscast";
    return buildResult(
      outcome,
      matchResult,
      candidate,
      topology,
      [
        ...baseReasons,
        ...topologyReasons,
        makeReason(
          "critical_topology_failure",
          `Critical topology failure on ${riskLevel}-risk candidate resolved as ${outcome}.`,
          "failure",
        ),
      ],
      options,
    );
  }

  if (confidence < severeConfidenceThreshold) {
    return buildResult(
      "fizzle",
      matchResult,
      candidate,
      topology,
      [
        ...baseReasons,
        makeReason(
          "confidence_far_below_threshold",
          `Confidence ${confidence.toFixed(3)} is below severe threshold ${severeConfidenceThreshold.toFixed(3)}.`,
          "failure",
        ),
        ...topologyReasons,
      ],
      options,
    );
  }

  if (confidence < minConfidence) {
    return buildResult(
      "partial",
      matchResult,
      candidate,
      topology,
      [
        ...baseReasons,
        makeReason(
          "confidence_below_threshold",
          `Confidence ${confidence.toFixed(3)} is below required ${minConfidence.toFixed(3)}.`,
          "warning",
        ),
        ...topologyReasons,
      ],
      options,
    );
  }

  if (matchResult.semanticMargin < minSemanticMargin) {
    const highConfidenceAmbiguityThreshold = Math.min(0.92, minConfidence + 0.14);
    const weakCastAmbiguityThreshold = Math.min(0.8, minConfidence + 0.05);
    const forgivingRole = candidate?.template.semantic_role === "element"
      || candidate?.template.semantic_role === "form";

    if (confidence >= highConfidenceAmbiguityThreshold) {
      return buildResult(
        "partial",
        matchResult,
        candidate,
        topology,
        [
          ...baseReasons,
          makeReason(
            "semantic_margin_below_threshold_high_confidence",
            `Semantic margin ${matchResult.semanticMargin.toFixed(3)} is below required ${minSemanticMargin.toFixed(3)}, but confidence ${confidence.toFixed(3)} is high enough for a partial cast.`,
            "warning",
          ),
          ...topologyReasons,
        ],
        options,
      );
    }

    if (forgivingRole && confidence >= weakCastAmbiguityThreshold) {
      return buildResult(
        "cast_weak",
        matchResult,
        candidate,
        topology,
        [
          ...baseReasons,
          makeReason(
            "semantic_margin_below_threshold_weak_cast",
            `Semantic margin ${matchResult.semanticMargin.toFixed(3)} is below required ${minSemanticMargin.toFixed(3)}, but confidence ${confidence.toFixed(3)} is enough for a weak cast.`,
            "warning",
          ),
          ...topologyReasons,
        ],
        options,
      );
    }

    return buildResult(
      "miscast",
      matchResult,
      candidate,
      topology,
      [
        ...baseReasons,
        makeReason(
          "semantic_margin_below_threshold",
          `Semantic margin ${matchResult.semanticMargin.toFixed(3)} is below required ${minSemanticMargin.toFixed(3)}.`,
          "failure",
        ),
        ...topologyReasons,
      ],
      options,
    );
  }

  if (topology && !topology.isValid) {
    return buildResult(
      weakTopologyOutcome,
      matchResult,
      candidate,
      topology,
      [
        ...baseReasons,
        ...topologyReasons,
        makeReason(
          "non_critical_topology_failure",
          `Non-critical topology issue resolved as ${weakTopologyOutcome}.`,
          "warning",
        ),
      ],
      options,
    );
  }

  return buildResult(
    "cast_clean",
    matchResult,
    candidate,
    topology,
    [
      ...baseReasons,
      makeReason(
        "thresholds_passed",
        "Confidence, semantic margin, and topology thresholds passed for recognition.",
        "info",
      ),
    ],
    options,
  );
};
