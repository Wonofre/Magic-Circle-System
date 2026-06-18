import {
  fitCircleToPoints,
  fitCircleToStroke,
  isCircleLike,
  makeCircleInstance,
  pointInsideCircle,
} from "@/lib/geometry/circleFit";
import { detectChannelsV2 } from "@/lib/recognizerV2/channelDetectorV2";
import {
  recognizeMandalaComponentsV2,
  recognizeMandalaComponentsV2Probabilistically,
  recognizeMandalaComponentsV2WithInterpretations,
  type ComponentRecognition,
} from "@/lib/recognizerV2/componentRecognizerV2";
import { interpretHolisticMandala } from "@/lib/recognizer/ml/mandalaVisionLite";
import { fuseRecognitionScores } from "@/lib/recognizerV2/scoreFusion";
import { getCandidateTopologySignature } from "@/lib/recognizerV2/candidateSignature";
import { stitchShortStrokes } from "@/lib/recognizerV2/strokeStitch";
import { compileMagicFormulaV2 } from "@/lib/spellV2/formulaCompilerV2";
import { getCatalogKey, getCatalogSigil, magicCatalogV2 } from "@/data/magicCatalogV2";
import { getV2BindingForTemplateId } from "@/data/magicOntology";
import type { RecognitionStroke } from "@/types/recognition";
import type {
  ProbabilisticRecognitionResult,
  RecognitionBounds,
  SemanticMarginResult,
} from "@/types/recognition";
import type {
  CircleInstanceV2,
  KeyInstanceV2,
  MagicPointV2,
  SigilInstanceV2,
} from "@/types/magicFormulaV2";

type ComponentRecognitionV2 = ReturnType<typeof recognizeMandalaComponentsV2>["recognitions"][number];

export interface ParsedMandalaV2 {
  readonly strokes: readonly RecognitionStroke[];
  readonly castingCircle?: CircleInstanceV2;
  readonly sigilContainment?: CircleInstanceV2;
  readonly keyScopeCircles: readonly CircleInstanceV2[];
  readonly sigils: readonly SigilInstanceV2[];
  readonly keys: readonly KeyInstanceV2[];
  readonly channels: ReturnType<typeof detectChannelsV2>;
  readonly componentRecognitions: readonly ComponentRecognitionV2[];
  readonly excludedStrokeIds: ReadonlySet<string>;
}

export interface ParsedMandalaCandidateV2 {
  readonly parsed: ParsedMandalaV2;
  readonly semanticResults: readonly SemanticMarginResult[];
  readonly recognitionScore: number;
}

export interface ParsedMandalaCandidateSetV2 {
  readonly candidates: readonly ParsedMandalaCandidateV2[];
  readonly probabilistic?: ProbabilisticRecognitionResult;
}

const clamp = (value: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, value));

const strokeId = (stroke: RecognitionStroke, index: number): string =>
  stroke.id ?? `stroke:${index}`;

const getRecognitionTemplateId = (recognition: ComponentRecognitionV2): string | undefined =>
  recognition.semantic.candidate?.template.id;

const getRecognitionCenter = (recognition: ComponentRecognitionV2): MagicPointV2 => {
  const points = recognition.strokes.flatMap((stroke) => stroke.points);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  if (xs.length === 0 || ys.length === 0) return { x: 50, y: 50 };

  return {
    x: Number(((Math.min(...xs) + Math.max(...xs)) / 2).toFixed(2)),
    y: Number(((Math.min(...ys) + Math.max(...ys)) / 2).toFixed(2)),
  };
};

const circleConcentricity = (circle: CircleInstanceV2, castingCircle: CircleInstanceV2): number => {
  const centerDistance = Math.hypot(
    circle.center.x - castingCircle.center.x,
    circle.center.y - castingCircle.center.y,
  );
  return clamp(1 - centerDistance / Math.max(1, castingCircle.radius * 0.45));
};

const detectCircles = (strokes: readonly RecognitionStroke[]) => {
  const candidates = strokes
    .map((stroke, index) => ({ stroke, index, fit: fitCircleToStroke(stroke) }))
    .filter(({ fit }) => isCircleLike(fit, { minClosure: 0.48, minRoundness: 0.42, minQuality: 0.48 }))
    .sort((a, b) => b.fit!.radius - a.fit!.radius);
  const casting = candidates[0];

  if (!casting?.fit) {
    return {
      castingCircle: undefined,
      sigilContainment: undefined,
      keyScopeCircles: [] as CircleInstanceV2[],
      circleStrokeIds: new Set<string>(),
      smallCircleCandidates: [] as CircleInstanceV2[],
    };
  }

  const castingCircle = makeCircleInstance({
    id: "circle:casting",
    role: "casting_circle",
    fit: casting.fit,
    concentricity: 1,
    strokeIds: [strokeId(casting.stroke, casting.index)],
  });
  const smallCircles = candidates.slice(1).flatMap(({ stroke, index, fit }) => {
    if (!fit || fit.radius >= castingCircle.radius * 0.82) return [];
    const centerDistance = Math.hypot(fit.center.x - castingCircle.center.x, fit.center.y - castingCircle.center.y);
    const isCore = centerDistance <= castingCircle.radius * 0.24 && fit.radius <= castingCircle.radius * 0.48;
    const role = isCore ? "sigil_containment" : "key_scope";
    const instance = makeCircleInstance({
      id: `${role === "sigil_containment" ? "circle:sigil" : "circle:key"}:${index}`,
      role,
      fit,
      concentricity: circleConcentricity(
        makeCircleInstance({
          id: "tmp",
          role,
          fit,
          concentricity: 0,
          strokeIds: [strokeId(stroke, index)],
        }),
        castingCircle,
      ),
      strokeIds: [strokeId(stroke, index)],
    });
    return [instance];
  });

  return {
    castingCircle,
    sigilContainment: undefined,
    keyScopeCircles: [] as CircleInstanceV2[],
    circleStrokeIds: new Set<string>(castingCircle.strokeIds),
    smallCircleCandidates: smallCircles,
  };
};

const getRecognitionStrokeIds = (
  recognitions: readonly ComponentRecognitionV2[],
  strokes: readonly RecognitionStroke[],
): ReadonlySet<string> =>
  new Set(
    recognitions.flatMap((recognition) =>
      recognition.sourceIndexes.map((sourceIndex) => strokeId(strokes[sourceIndex], sourceIndex)),
    ),
  );

const selectStructuralCircles = (
  smallCircleCandidates: readonly CircleInstanceV2[],
  recognitions: readonly ComponentRecognitionV2[],
  strokes: readonly RecognitionStroke[],
) => {
  const hintedGlyphStrokeIds = new Set(
    strokes.flatMap((stroke, index) => {
      const binding = stroke.semanticTemplateId
        ? getV2BindingForTemplateId(stroke.semanticTemplateId)
        : undefined;
      return binding && binding.type !== "casting_circle"
        ? [strokeId(stroke, index)]
        : [];
    }),
  );
  const recognitionDetails = recognitions.map((recognition) => {
    const templateId = getRecognitionTemplateId(recognition);
    const binding = templateId ? getV2BindingForTemplateId(templateId) : undefined;
    return {
      recognition,
      binding,
      center: getRecognitionCenter(recognition),
      strokeIds: new Set(
        recognition.sourceIndexes.map((sourceIndex) => strokeId(strokes[sourceIndex], sourceIndex)),
      ),
    };
  });
  const circleBelongsToStrongGlyph = (circle: CircleInstanceV2): boolean =>
    recognitionDetails.some(({ recognition, binding, strokeIds }) =>
      binding &&
      binding.type !== "casting_circle" &&
      circle.strokeIds.some((id) => strokeIds.has(id)) &&
      recognition.sourceIndexes.length > 1 &&
      recognition.semantic.confidence >= 0.7,
    );
  const containsIndependentKey = (circle: CircleInstanceV2): boolean =>
    recognitionDetails.some(({ binding, center, strokeIds }) =>
      binding?.type === "key" &&
      circle.strokeIds.every((id) => !strokeIds.has(id)) &&
      pointInsideCircle(center, circle, 4),
    );
  const structuralCircles = smallCircleCandidates.filter((circle) => {
    if (circle.strokeIds.some((id) => hintedGlyphStrokeIds.has(id))) return false;
    if (circleBelongsToStrongGlyph(circle)) return false;
    if (circle.role === "sigil_containment") return true;
    return containsIndependentKey(circle);
  });
  const sigilContainment = structuralCircles
    .filter((circle) => circle.role === "sigil_containment")
    .sort((a, b) => b.quality - a.quality)[0];
  const keyScopeCircles = structuralCircles.filter(
    (circle) => circle.role === "key_scope" && circle.id !== sigilContainment?.id,
  );
  const structuralCircleStrokeIds = new Set(
    structuralCircles.flatMap((circle) => circle.strokeIds),
  );

  return {
    sigilContainment,
    keyScopeCircles,
    structuralCircleStrokeIds,
  };
};

const findContainingCircle = (
  point: MagicPointV2,
  circles: readonly CircleInstanceV2[],
): CircleInstanceV2 | undefined =>
  circles
    .filter((circle) => pointInsideCircle(point, circle, 4))
    .sort((a, b) => a.radius - b.radius)[0];

const getRecognitionClosure = (recognition: ComponentRecognitionV2): number => {
  const points = recognition.strokes.flatMap((stroke) => stroke.points);
  return fitCircleToPoints(points)?.closure ?? 0;
};

const buildSigils = (
  recognitions: readonly ComponentRecognitionV2[],
  sigilContainment?: CircleInstanceV2,
): readonly SigilInstanceV2[] =>
  recognitions.flatMap((recognition, index) => {
    const templateId = getRecognitionTemplateId(recognition);
    const binding = templateId ? getV2BindingForTemplateId(templateId) : undefined;
    if (!templateId || binding?.type !== "sigil") return [];

    const catalogSigil = getCatalogSigil(binding.sigilId);
    const center = getRecognitionCenter(recognition);
    const closure = getRecognitionClosure(recognition);
    const containedByCircleId =
      sigilContainment && pointInsideCircle(center, sigilContainment, sigilContainment.radius * 0.2)
        ? sigilContainment.id
        : undefined;

    return [{
      id: `sigil:${index}:${binding.sigilId}`,
      sigilId: binding.sigilId,
      templateId,
      confidence: Number(recognition.semantic.confidence.toFixed(3)),
      closure: Number(closure.toFixed(3)),
      isClosed: closure >= 0.72,
      center,
      containedByCircleId,
      futureEffectHints: catalogSigil.futureEffectHints,
    }];
  });

const buildKeys = (
  recognitions: readonly ComponentRecognitionV2[],
  keyScopeCircles: readonly CircleInstanceV2[],
): readonly KeyInstanceV2[] =>
  recognitions.flatMap((recognition, index) => {
    const templateId = getRecognitionTemplateId(recognition);
    const binding = templateId ? getV2BindingForTemplateId(templateId) : undefined;
    if (!templateId || binding?.type !== "key") return [];

    const center = getRecognitionCenter(recognition);
    const containingCircle = findContainingCircle(center, keyScopeCircles);
    const scope = containingCircle
      ? containingCircle.quality >= magicCatalogV2.circleRules.keyScopeCircle.minClosure
        ? "local"
        : "unstable"
      : "global";
    const catalogKey = getCatalogKey(binding.keyId);

    return [{
      id: `key:${index}:${binding.keyId}`,
      keyId: binding.keyId,
      templateId,
      kind: binding.keyKind,
      confidence: Number(recognition.semantic.confidence.toFixed(3)),
      center,
      containedByCircleId: containingCircle?.id,
      scope,
      futureEffectTags: catalogKey.futureEffectTags,
    }];
  });

const frameBoundsFromCircle = (
  circle: CircleInstanceV2 | undefined,
): RecognitionBounds | undefined =>
  circle
    ? {
        minX: circle.center.x - circle.radius,
        minY: circle.center.y - circle.radius,
        maxX: circle.center.x + circle.radius,
        maxY: circle.center.y + circle.radius,
        width: circle.radius * 2,
        height: circle.radius * 2,
      }
    : undefined;

export const assembleParsedMandala = (
  strokes: readonly RecognitionStroke[],
  recognitions: readonly ComponentRecognition[],
  castingCircle: CircleInstanceV2 | undefined,
  sigilContainment: CircleInstanceV2 | undefined,
  keyScopeCircles: readonly CircleInstanceV2[],
  hardCircleStrokeIds: ReadonlySet<string>,
): ParsedMandalaV2 => {
  const componentStrokeIds = getRecognitionStrokeIds(recognitions, strokes);
  const sigils = buildSigils(recognitions, sigilContainment);
  const keys = buildKeys(recognitions, keyScopeCircles);
  const recognizedStrokeIds = new Set<string>([
    ...hardCircleStrokeIds,
    ...componentStrokeIds,
  ]);
  const channels = castingCircle
    ? detectChannelsV2({
        strokes,
        sigils,
        keys,
        containment: sigilContainment,
        castingCircle,
        excludedStrokeIds: recognizedStrokeIds,
        hardExcludedStrokeIds: hardCircleStrokeIds,
      })
    : [];

  return {
    strokes,
    castingCircle,
    sigilContainment,
    keyScopeCircles,
    sigils,
    keys,
    channels,
    componentRecognitions: recognitions,
    excludedStrokeIds: recognizedStrokeIds,
  };
};

const shouldStitchStrokes = (strokes: readonly RecognitionStroke[]): boolean =>
  strokes.some(
    (stroke) =>
      stroke.id?.includes(":segment:") ||
      Boolean(stroke.semanticGroupId) ||
      Boolean(stroke.semanticTemplateId),
  );

const normalizeStrokesForParse = (
  strokes: readonly RecognitionStroke[],
): readonly RecognitionStroke[] =>
  shouldStitchStrokes(strokes) ? stitchShortStrokes(strokes) : strokes;

export const parseMandalaV2FromStrokes = (
  strokes: readonly RecognitionStroke[],
): ParsedMandalaV2 => {
  const normalizedStrokes = normalizeStrokesForParse(strokes);
  const {
    castingCircle,
    circleStrokeIds,
    smallCircleCandidates,
  } = detectCircles(normalizedStrokes);
  const preliminaryComponentParse = recognizeMandalaComponentsV2(normalizedStrokes, {
    excludedStrokeIds: circleStrokeIds,
  });
  const {
    sigilContainment,
    keyScopeCircles,
    structuralCircleStrokeIds,
  } = selectStructuralCircles(
    smallCircleCandidates,
    preliminaryComponentParse.recognitions,
    normalizedStrokes,
  );
  const hardCircleStrokeIds = new Set([
    ...circleStrokeIds,
    ...structuralCircleStrokeIds,
  ]);
  const componentParse = structuralCircleStrokeIds.size > 0
    ? recognizeMandalaComponentsV2(normalizedStrokes, {
        excludedStrokeIds: hardCircleStrokeIds,
      })
    : preliminaryComponentParse;

  return assembleParsedMandala(
    normalizedStrokes,
    componentParse.recognitions,
    castingCircle,
    sigilContainment,
    keyScopeCircles,
    hardCircleStrokeIds,
  );
};

export const parseMandalaV2CandidatesFromStrokes = async (
  strokes: readonly RecognitionStroke[],
): Promise<ParsedMandalaCandidateSetV2> => {
  const normalizedStrokes = normalizeStrokesForParse(strokes);
  const {
    castingCircle,
    circleStrokeIds,
    smallCircleCandidates,
  } = detectCircles(normalizedStrokes);
  const frameBounds = frameBoundsFromCircle(castingCircle);
  const preliminaryComponentParse =
    await recognizeMandalaComponentsV2Probabilistically(normalizedStrokes, {
      excludedStrokeIds: circleStrokeIds,
      frameBounds,
    });
  const {
    sigilContainment,
    keyScopeCircles,
    structuralCircleStrokeIds,
  } = selectStructuralCircles(
    smallCircleCandidates,
    preliminaryComponentParse.recognitions,
    normalizedStrokes,
  );
  const hardCircleStrokeIds = new Set([
    ...circleStrokeIds,
    ...structuralCircleStrokeIds,
  ]);
  const componentParse = structuralCircleStrokeIds.size > 0
    ? await recognizeMandalaComponentsV2Probabilistically(normalizedStrokes, {
        excludedStrokeIds: hardCircleStrokeIds,
        frameBounds,
      })
    : preliminaryComponentParse;
  const interpretations = componentParse.interpretations.length > 0
    ? componentParse.interpretations
    : [componentParse.recognitions];
  const candidates = interpretations.map((recognitions) => ({
    parsed: assembleParsedMandala(
      normalizedStrokes,
      recognitions,
      castingCircle,
      sigilContainment,
      keyScopeCircles,
      hardCircleStrokeIds,
    ),
    semanticResults: recognitions.map((recognition) => recognition.semantic),
    recognitionScore: recognitions.reduce(
      (sum, recognition) => sum + recognition.score,
      0,
    ),
  }));

  return {
    candidates,
    probabilistic: componentParse.probabilistic,
  };
};

export const parseMandalaV2CandidatesHolistically = (
  strokes: readonly RecognitionStroke[],
): ParsedMandalaCandidateSetV2 => {
  const normalizedStrokes = normalizeStrokesForParse(strokes);
  const {
    castingCircle,
    circleStrokeIds,
    smallCircleCandidates,
  } = detectCircles(normalizedStrokes);
  const preliminaryComponentParse = recognizeMandalaComponentsV2WithInterpretations(normalizedStrokes, {
    excludedStrokeIds: circleStrokeIds,
  });
  const {
    sigilContainment,
    keyScopeCircles,
    structuralCircleStrokeIds,
  } = selectStructuralCircles(
    smallCircleCandidates,
    preliminaryComponentParse.recognitions,
    normalizedStrokes,
  );
  const hardCircleStrokeIds = new Set([
    ...circleStrokeIds,
    ...structuralCircleStrokeIds,
  ]);
  const componentParse = structuralCircleStrokeIds.size > 0
    ? recognizeMandalaComponentsV2WithInterpretations(normalizedStrokes, {
        excludedStrokeIds: hardCircleStrokeIds,
      })
    : preliminaryComponentParse;
  const interpretations = componentParse.interpretations.length > 0
    ? componentParse.interpretations
    : [componentParse.recognitions];

  const candidates = interpretations.map((recognitions) => {
    const parsed = assembleParsedMandala(
      normalizedStrokes,
      recognitions,
      castingCircle,
      sigilContainment,
      keyScopeCircles,
      hardCircleStrokeIds,
    );
    const baseScore = recognitions.reduce(
      (sum, recognition) => sum + recognition.score,
      0,
    );
    const formula = compileMagicFormulaV2(parsed);
    const holistic = interpretHolisticMandala(strokes, parsed, formula);
    return {
      parsed,
      semanticResults: recognitions.map((recognition) => recognition.semantic),
      recognitionScore: baseScore + holistic.recognitionBoost,
    };
  });

  return { candidates };
};

export const parseMandalaV2CandidatesFused = async (
  strokes: readonly RecognitionStroke[],
): Promise<ParsedMandalaCandidateSetV2> => {
  const [holistic, probabilistic] = await Promise.all([
    Promise.resolve(parseMandalaV2CandidatesHolistically(strokes)),
    parseMandalaV2CandidatesFromStrokes(strokes),
  ]);

  const mlBySignature = new Map<string, ParsedMandalaCandidateV2>();
  probabilistic.candidates.forEach((candidate) => {
    const signature = getCandidateTopologySignature(candidate.parsed);
    const existing = mlBySignature.get(signature);
    if (!existing || candidate.recognitionScore > existing.recognitionScore) {
      mlBySignature.set(signature, candidate);
    }
  });
  const seen = new Set<string>();

  const fusedCandidates = holistic.candidates.map((holisticCandidate) => {
    const signature = getCandidateTopologySignature(holisticCandidate.parsed);
    seen.add(signature);
    const mlCandidate = mlBySignature.get(signature);
    const fusedScore = fuseRecognitionScores(
      holisticCandidate.recognitionScore,
      mlCandidate?.recognitionScore ?? holisticCandidate.recognitionScore,
      Boolean(mlCandidate),
    );

    return {
      ...holisticCandidate,
      recognitionScore: fusedScore,
    };
  });

  probabilistic.candidates.forEach((mlCandidate) => {
    const signature = getCandidateTopologySignature(mlCandidate.parsed);
    if (seen.has(signature)) return;
    fusedCandidates.push({
      ...mlCandidate,
      recognitionScore: fuseRecognitionScores(0, mlCandidate.recognitionScore, true),
    });
  });

  return {
    candidates: fusedCandidates,
    probabilistic: probabilistic.probabilistic,
  };
};
