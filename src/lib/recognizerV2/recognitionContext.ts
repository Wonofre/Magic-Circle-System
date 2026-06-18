import { getElementSigilForTemplateId } from "@/data/magicOntology";
import type { ElementSigilId } from "@/types/magicFormulaV2";
import type { ParsedMandalaV2 } from "@/lib/recognizerV2/mandalaParserV2";
import type { MagicFormulaV2 } from "@/types/magicFormulaV2";

export interface RecognitionContext {
  readonly allowedTemplateIds?: ReadonlySet<string>;
  readonly enemyWeakness?: ElementSigilId | null;
  readonly boostTemplateIds?: ReadonlySet<string>;
}

export const scoreTemplateAgainstContext = (
  templateId: string,
  context?: RecognitionContext,
): number => {
  if (!context) return 0;

  let boost = 0;
  if (context.allowedTemplateIds?.has(templateId)) boost += 0.12;
  if (context.boostTemplateIds?.has(templateId)) boost += 0.18;
  if (context.enemyWeakness) {
    const sigilId = getElementSigilForTemplateId(templateId);
    if (sigilId === context.enemyWeakness) boost += 0.15;
  }
  if (context.allowedTemplateIds && !context.allowedTemplateIds.has(templateId)) {
    boost -= 0.28;
  }
  return boost;
};

export const scoreParsedAgainstContext = (
  parsed: ParsedMandalaV2,
  context?: RecognitionContext,
): number => {
  if (!context) return 0;

  const templateIds = [
    ...parsed.sigils.map((sigil) => sigil.templateId),
    ...parsed.keys.map((key) => key.templateId),
    ...parsed.componentRecognitions.flatMap((recognition) =>
      recognition.semantic.candidate ? [recognition.semantic.candidate.template.id] : [],
    ),
  ];

  return templateIds.reduce(
    (sum, templateId) => sum + scoreTemplateAgainstContext(templateId, context),
    0,
  );
};

export const formulaCompletenessScore = (formula: MagicFormulaV2): number => {
  let score = 0;
  if (formula.castingCircle) score += 1.5;
  if (formula.sigils.length > 0) score += 1.2;
  if (formula.keys.length > 0) score += 1;
  if (formula.channels.length > 0) score += 0.8;
  if (formula.sigilContainment) score += 0.3;
  if (formula.keyScopeCircles.length > 0) score += 0.2;
  return score;
};

export const miscastPenalty = (formula: MagicFormulaV2): number => {
  const weakComponents = formula.sigils.filter((sigil) => sigil.confidence < 0.62).length
    + formula.keys.filter((key) => key.confidence < 0.62).length;
  return weakComponents * 0.35;
};