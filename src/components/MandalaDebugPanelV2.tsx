import { GitBranch, Scale, ShieldAlert } from "lucide-react";
import {
  getRuneBindingLabel,
  getRuneNameForTemplate,
} from "@/lib/ui/runeCatalogPresentation";
import type { MagicFormulaV2 } from "@/types/magicFormulaV2";
import type { RecognitionTelemetryEvent } from "@/types/telemetry";

interface MandalaDebugPanelV2Props {
  readonly formula?: MagicFormulaV2;
  readonly telemetry?: RecognitionTelemetryEvent;
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;

export function MandalaDebugPanelV2({ formula, telemetry }: MandalaDebugPanelV2Props) {
  if (!formula) return null;

  const failedIssues = formula.issues.filter((issue) => issue.severity === "error");
  const acceptedVisionCandidates = telemetry?.regions?.flatMap((region) =>
    region.candidates
      .filter((candidate) => candidate.acceptedByClassThreshold)
      .slice(0, 1)
      .map((candidate) => ({ regionId: region.id, candidate })),
  ) ?? [];

  return (
    <section className="mt-3 rounded-lg border border-[#6d3f1f]/25 bg-[#6d3f1f]/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f421c]">
          <Scale className="w-3.5 h-3.5" />
          Simetria V2
        </p>
        <span className="rounded-sm bg-black/10 px-1.5 py-0.5 text-[10px] text-[#6f421c]">
          {formula.visual.rank}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px] text-[#563119]">
        <span>radial {percent(formula.symmetry.radialBalance)}</span>
        <span>espaco {percent(formula.symmetry.keyAngularSpacing)}</span>
        <span>canais {percent(formula.symmetry.channelArcRegularity)}</span>
        <span>circulos {percent(formula.symmetry.circleConcentricity)}</span>
        <span>espelho {percent(formula.symmetry.mirrorBalance)}</span>
        <span>limpeza {percent(formula.symmetry.strokeCleanliness)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        <span className="inline-flex items-center gap-1 rounded-sm bg-black/10 px-1.5 py-0.5 text-[#563119]">
          <GitBranch className="w-3 h-3" />
          {formula.channels.length} canais
        </span>
        {failedIssues.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-red-900/10 px-1.5 py-0.5 text-red-800">
            <ShieldAlert className="w-3 h-3" />
            {failedIssues.length} falha(s)
          </span>
        )}
        {telemetry?.model && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-black/10 px-1.5 py-0.5 text-[#563119]">
            ML {telemetry.model.provider ?? telemetry.model.status}
            {telemetry.model.version ? ` ${telemetry.model.version}` : ""}
            {` ${Math.round(telemetry.model.latencyMs)}ms`}
          </span>
        )}
      </div>
      {telemetry?.regions && telemetry.regions.length > 0 && (
        <>
          <p className="mt-2 text-[10px] text-[#563119]/75">
            {telemetry.regions.length} regioes,{" "}
            {telemetry.regions.filter((region) => region.rejected).length} rejeitadas.
          </p>
          {acceptedVisionCandidates.length > 0 && (
            <div className="mt-2 space-y-1 text-[10px] text-[#563119]/80">
              {acceptedVisionCandidates.map(({ regionId, candidate }) => (
                <p key={regionId}>
                  {getRuneNameForTemplate(candidate.templateId)}:{" "}
                  {getRuneBindingLabel(candidate.templateId)} |{" "}
                  {percent(candidate.confidence)} / min {percent(candidate.confidenceThreshold)}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
