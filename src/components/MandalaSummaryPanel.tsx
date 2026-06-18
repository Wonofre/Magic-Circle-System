import { AlertTriangle, Sparkles } from "lucide-react";
import type { MagicFormulaV2 } from "@/types/magicFormulaV2";
import type { SpellCard } from "@/types/spellCard";

interface MandalaSummaryPanelProps {
  readonly spellName?: string;
  readonly formula?: MagicFormulaV2;
  readonly spellCard?: SpellCard;
  readonly precision?: number;
  readonly feedback?: string;
  readonly isSuccess?: boolean;
}

const visualRankStars = (rank: string | undefined): string => {
  switch (rank) {
    case "perfect":
    case "symmetric":
      return "★★★";
    case "stable":
      return "★★☆";
    case "rough":
      return "★☆☆";
    case "fractured":
      return "☆☆☆";
    default:
      return "☆☆☆";
  }
};

const cohesionFromFormula = (formula: MagicFormulaV2): number =>
  Math.round(
    (
      formula.symmetry.overall * 0.45 +
      formula.symmetry.strokeCleanliness * 0.25 +
      formula.symmetry.channelArcRegularity * 0.2 +
      (1 - formula.visual.instability) * 0.1
    ) * 100,
  );

const precisionFromFormula = (formula: MagicFormulaV2, override?: number): number => {
  if (override !== undefined) return Math.round(override);
  const components = [...formula.sigils, ...formula.keys];
  if (components.length === 0) return 0;
  const confidence =
    components.reduce((sum, component) => sum + component.confidence, 0) / components.length;
  const circleBonus = (formula.castingCircle?.quality ?? 0) * 0.15;
  return Math.round((confidence * 0.75 + circleBonus + formula.symmetry.overall * 0.1) * 100);
};

const diegeticIssue = (formula: MagicFormulaV2): string | null => {
  const issue = formula.issues.find((entry) => entry.severity === "error");
  if (!issue) return null;
  switch (issue.code) {
    case "missing_casting_circle":
      return "Falta o circulo externo de conjuracao.";
    case "casting_circle_open":
      return "O circulo externo nao esta fechado.";
    case "missing_central_sigil":
      return "Desenhe um sigilo de elemento no centro.";
    case "straight_key_channel":
      return "Refaca a ligacao entre chaves com uma curva suave.";
    case "channel_crosses_casting_circle":
      return "Mantenha os canais dentro do circulo externo.";
    default:
      return issue.message;
  }
};

export function MandalaSummaryPanel({
  spellName,
  formula,
  spellCard,
  precision,
  feedback,
  isSuccess,
}: MandalaSummaryPanelProps) {
  if (!formula && !spellName && !feedback) return null;

  const name = spellName ?? spellCard?.name ?? formula?.name ?? "Mandala";
  const cohesion = formula ? cohesionFromFormula(formula) : undefined;
  const resolvedPrecision = formula ? precisionFromFormula(formula, precision) : precision;
  const issue = formula ? diegeticIssue(formula) : null;
  const sigilCount = formula?.sigils.length ?? 0;
  const keyCount = formula?.keys.length ?? 0;
  const channelCount = formula?.channels.length ?? 0;

  return (
    <section className="mt-3 rounded-lg border border-[#6d3f1f]/25 bg-[#f8edd4]/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold text-[#4b2a19]">
          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
          {name}
        </p>
        <span className="text-[10px] tracking-wider text-amber-800/80">
          {visualRankStars(formula?.visual.rank ?? spellCard?.formula.visual.rank)}
        </span>
      </div>

      {(resolvedPrecision !== undefined || cohesion !== undefined) && (
        <p className="text-[11px] text-[#563119]">
          {resolvedPrecision !== undefined && <>Precisao {resolvedPrecision}%</>}
          {resolvedPrecision !== undefined && cohesion !== undefined && "  ·  "}
          {cohesion !== undefined && <>Coesao {cohesion}%</>}
        </p>
      )}

      {formula && (
        <p className="mt-1 text-[10px] text-[#6f421c]/85">
          {sigilCount} sigilo{sigilCount === 1 ? "" : "s"} · {keyCount} chave{keyCount === 1 ? "" : "s"} · {channelCount} canal{channelCount === 1 ? "" : "is"}
        </p>
      )}

      {issue && (
        <p className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-700" />
          <span>{issue}</span>
        </p>
      )}

      {!isSuccess && feedback && !issue && (
        <p className="mt-2 text-[10px] leading-relaxed text-[#6f421c]">{feedback}</p>
      )}
    </section>
  );
}