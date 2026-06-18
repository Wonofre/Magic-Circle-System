import type { RecognitionStroke } from "@/types/recognition";

const MIN_STITCH_PATH_LENGTH = 6;
const MAX_STITCH_GAP = 14;

const strokePathLength = (stroke: RecognitionStroke): number => {
  let length = 0;
  for (let index = 1; index < stroke.points.length; index += 1) {
    const previous = stroke.points[index - 1];
    const current = stroke.points[index];
    length += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return length;
};

const endpointDistance = (a: RecognitionStroke, b: RecognitionStroke): number => {
  const aLast = a.points[a.points.length - 1];
  const bFirst = b.points[0];
  if (!aLast || !bFirst) return Infinity;
  return Math.hypot(aLast.x - bFirst.x, aLast.y - bFirst.y);
};

const strokeGroupKey = (stroke: RecognitionStroke): string | undefined => {
  if (stroke.semanticTemplateId) return stroke.semanticTemplateId;

  const id = stroke.id ?? "";
  const templatePrefix = id.match(/^([A-Z][A-Z0-9_]+):/);
  if (templatePrefix?.[1]) return templatePrefix[1];

  return undefined;
};

const shareStitchGroup = (a: RecognitionStroke, b: RecognitionStroke): boolean => {
  if (a.semanticGroupId && b.semanticGroupId) {
    return a.semanticGroupId === b.semanticGroupId;
  }

  const groupA = strokeGroupKey(a);
  const groupB = strokeGroupKey(b);
  if (groupA && groupB) return groupA === groupB;

  return (
    (a.id?.includes(":segment:") ?? false)
    && (b.id?.includes(":segment:") ?? false)
    && a.points.length === 2
    && b.points.length === 2
  );
};

const isShortActionStroke = (stroke: RecognitionStroke): boolean =>
  stroke.points.length <= 6 || strokePathLength(stroke) < MIN_STITCH_PATH_LENGTH;

const canStitchPair = (current: RecognitionStroke, next: RecognitionStroke): boolean => {
  if (!shareStitchGroup(current, next)) return false;
  if (endpointDistance(current, next) > MAX_STITCH_GAP) return false;
  if (!isShortActionStroke(current)) return false;
  if (!isShortActionStroke(next) && strokePathLength(next) > MIN_STITCH_PATH_LENGTH * 2) return false;
  return true;
};

export const stitchShortStrokes = (
  strokes: readonly RecognitionStroke[],
): readonly RecognitionStroke[] => {
  if (strokes.length < 2) return strokes;

  const stitched: RecognitionStroke[] = [];
  const consumed = new Set<number>();

  for (let index = 0; index < strokes.length; index += 1) {
    if (consumed.has(index)) continue;

    const current = strokes[index];
    if (!isShortActionStroke(current)) {
      stitched.push(current);
      continue;
    }

    let merged = current;
    let cursor = index;

    while (cursor + 1 < strokes.length) {
      const nextIndex = cursor + 1;
      const next = strokes[nextIndex];
      if (!next || consumed.has(nextIndex) || !canStitchPair(merged, next)) break;

      merged = {
        ...merged,
        id: `${merged.id}+${next.id}`,
        points: [...merged.points, ...next.points],
      };
      consumed.add(nextIndex);
      cursor = nextIndex;
    }

    consumed.add(index);
    stitched.push(merged);
  }

  return stitched.length > 0 ? stitched : strokes;
};