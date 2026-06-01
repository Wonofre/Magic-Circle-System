import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, GitBranch, XCircle } from "lucide-react";

import type {
  RecognitionOutcome,
  RecognitionStroke,
  SemanticDecisionReason,
  TemplateMatchCandidate,
  TopologyValidationCheck,
} from "@/types/recognition";
import { evaluateSemanticMargin } from "@/lib/recognizer/semanticMargin";
import { matchGlyphTemplates } from "@/lib/recognizer/templateMatcher";
import { validateGlyphTopology } from "@/lib/recognizer/topologyValidator";

interface GlyphDebugPanelProps {
  strokes: readonly RecognitionStroke[];
  enabled?: boolean;
}

const outcomeColor: Record<RecognitionOutcome, string> = {
  cast_clean: "text-emerald-300 border-emerald-700/50 bg-emerald-950/25",
  cast_weak: "text-lime-300 border-lime-700/50 bg-lime-950/25",
  partial: "text-amber-300 border-amber-700/50 bg-amber-950/25",
  miscast: "text-orange-300 border-orange-700/50 bg-orange-950/25",
  fizzle: "text-slate-300 border-slate-700/50 bg-slate-950/35",
  backfire: "text-red-300 border-red-700/50 bg-red-950/30",
};

const reasonColor: Record<SemanticDecisionReason["severity"], string> = {
  info: "text-sky-300/85",
  warning: "text-amber-300/90",
  failure: "text-red-300/90",
};

const checkIcon = (check: TopologyValidationCheck) => {
  if (check.status === "pass") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  }

  if (check.status === "warn") {
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  }

  return <XCircle className="h-3.5 w-3.5 text-red-400" />;
};

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const formatOutcome = (outcome: RecognitionOutcome): string => outcome.replace("_", " ");

const CandidateRow = ({ candidate }: { candidate: TemplateMatchCandidate }) => (
  <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-md border border-amber-900/20 bg-black/25 px-2 py-1.5">
    <span className="text-xs text-amber-500/80">#{candidate.rank}</span>
    <div className="min-w-0">
      <p className="truncate text-xs font-medium text-amber-200">
        {candidate.template.display_name}
      </p>
      <p className="truncate text-[11px] text-amber-600/80">
        {candidate.template.id}
      </p>
    </div>
    <div className="text-right">
      <p className="text-xs font-semibold text-amber-100">
        {formatPercent(candidate.confidence)}
      </p>
      <p className="text-[10px] text-amber-600/75">
        d {candidate.meanDistance.toFixed(1)}
      </p>
    </div>
  </div>
);

export function GlyphDebugPanel({ strokes, enabled = true }: GlyphDebugPanelProps) {
  const matchResult = useMemo(() => matchGlyphTemplates(strokes), [strokes]);
  const topologyResult = useMemo(() => {
    if (!matchResult.topCandidate || matchResult.inputRejected) {
      return null;
    }

    return validateGlyphTopology(
      matchResult.normalized.strokes,
      matchResult.topCandidate.template,
    );
  }, [matchResult]);
  const semanticResult = useMemo(
    () => evaluateSemanticMargin(matchResult, topologyResult ?? undefined),
    [matchResult, topologyResult],
  );

  if (!enabled) {
    return null;
  }

  const topCandidate = matchResult.topCandidate;

  return (
    <div className="mt-3 w-full rounded-lg border border-amber-800/40 bg-black/55 p-3 text-left shadow-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GitBranch className="h-4 w-4 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-amber-200">Glyph Debug</h3>
            <p className="truncate text-[11px] text-amber-600/80">
              {matchResult.inputRejected
                ? `Input rejected: ${matchResult.rejectionReason ?? "unknown"}`
                : topCandidate?.template.id ?? "No candidate"}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold ${outcomeColor[semanticResult.outcome]}`}
        >
          {formatOutcome(semanticResult.outcome)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-amber-950/20 px-2 py-1">
          <p className="text-[10px] uppercase text-amber-700">Confidence</p>
          <p className="font-semibold text-amber-200">
            {formatPercent(semanticResult.confidence)}
          </p>
        </div>
        <div className="rounded-md bg-amber-950/20 px-2 py-1">
          <p className="text-[10px] uppercase text-amber-700">Margin</p>
          <p className="font-semibold text-amber-200">
            {formatPercent(matchResult.semanticMargin)}
          </p>
        </div>
        <div className="rounded-md bg-amber-950/20 px-2 py-1">
          <p className="text-[10px] uppercase text-amber-700">Risk</p>
          <p className="font-semibold text-amber-200">{semanticResult.riskLevel}</p>
        </div>
      </div>

      {matchResult.scribble.isRejected && (
        <div className="mt-3 rounded-md border border-red-900/40 bg-red-950/20 px-2 py-2">
          <div className="mb-1 flex items-center gap-2">
            <CircleHelp className="h-3.5 w-3.5 text-red-300" />
            <span className="text-xs font-semibold text-red-200">
              {matchResult.scribble.outcome.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] text-red-200/80">
            {matchResult.scribble.reasons.join(", ") || "No reason recorded"}
          </p>
        </div>
      )}

      {matchResult.candidates.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-amber-700">
            Top candidates
          </p>
          {matchResult.candidates.map((candidate) => (
            <CandidateRow key={candidate.template.id} candidate={candidate} />
          ))}
        </div>
      )}

      {topologyResult && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-amber-700">
            Topology checks
          </p>
          {topologyResult.checks.map((check) => (
            <div
              key={check.id}
              className="flex items-start gap-2 rounded-md bg-black/25 px-2 py-1.5"
            >
              {checkIcon(check)}
              <div className="min-w-0">
                <p className="text-xs text-amber-200">{check.id}</p>
                <p className="text-[11px] text-amber-600/85">{check.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {semanticResult.reasons.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-amber-700">
            Decision reasons
          </p>
          {semanticResult.reasons.map((reason) => (
            <p key={`${reason.code}-${reason.message}`} className={`text-[11px] ${reasonColor[reason.severity]}`}>
              {reason.code}: {reason.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
