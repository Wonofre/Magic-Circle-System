import { compileMagicFormulaV2 } from "@/lib/spellV2/formulaCompilerV2";
import { parseMandalaV2FromStrokes } from "@/lib/recognizerV2/mandalaParserV2";
import {
  formulaCompletenessScore,
  miscastPenalty,
  scoreParsedAgainstContext,
  type RecognitionContext,
} from "@/lib/recognizerV2/recognitionContext";
import type {
  ParsedMandalaCandidateV2,
} from "@/lib/recognizerV2/mandalaParserV2";
import type { MagicFormulaV2 } from "@/types/magicFormulaV2";

const formulaValidityScore = (formula: MagicFormulaV2): number => {
  if (formula.validity === "valid_future_executable") return 4;
  if (formula.validity === "valid_visual_formula") return 3;
  if (formula.validity === "partial") return 2;
  return 0;
};

const aggregateRecognitionConfidence = (
  candidate: ParsedMandalaCandidateV2,
): number =>
  candidate.semanticResults.length > 0
    ? candidate.semanticResults.reduce((sum, result) => sum + result.confidence, 0)
      / candidate.semanticResults.length
    : 0;

const castableOutcomeBonus = (candidate: ParsedMandalaCandidateV2): number => {
  const outcomes = candidate.semanticResults.map((result) => result.outcome);
  const clean = outcomes.filter((outcome) => outcome === "cast_clean").length;
  const weak = outcomes.filter((outcome) => outcome === "cast_weak" || outcome === "partial").length;
  const failed = outcomes.length - clean - weak;
  return clean * 0.25 + weak * 0.08 - failed * 0.45;
};

export const rankParsedCandidate = (
  candidate: ParsedMandalaCandidateV2,
  context?: RecognitionContext,
): number => {
  const formula = compileMagicFormulaV2(candidate.parsed);
  return (
    formulaValidityScore(formula) * 2.4
    + formulaCompletenessScore(formula)
    + candidate.recognitionScore * 0.18
    + aggregateRecognitionConfidence(candidate) * 1.1
    + castableOutcomeBonus(candidate)
    + scoreParsedAgainstContext(candidate.parsed, context)
    - miscastPenalty(formula)
  );
};

export const chooseParsedCandidate = (
  candidates: readonly ParsedMandalaCandidateV2[],
  context?: RecognitionContext,
): {
  readonly candidate: ParsedMandalaCandidateV2;
  readonly formula: MagicFormulaV2;
} => {
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      formula: compileMagicFormulaV2(candidate.parsed),
      rankScore: rankParsedCandidate(candidate, context),
    }))
    .sort((first, second) => {
      const rankDelta = second.rankScore - first.rankScore;
      if (Math.abs(rankDelta) > 0.000001) return rankDelta;
      return first.formula.formulaHash.localeCompare(second.formula.formulaHash);
    });

  const selected = ranked[0];
  if (!selected) {
    const parsed = parseMandalaV2FromStrokes([]);
    return {
      candidate: { parsed, semanticResults: [], recognitionScore: 0 },
      formula: compileMagicFormulaV2(parsed),
    };
  }

  return {
    candidate: selected.candidate,
    formula: selected.formula,
  };
};