import type { RecognitionPoint, RecognitionStroke } from "@/types/recognition";

const distance = (a: RecognitionPoint, b: RecognitionPoint): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

const clonePoint = <TPoint extends RecognitionPoint>(point: TPoint): TPoint => ({ ...point });

export const getStrokePathLength = (points: readonly RecognitionPoint[]): number => {
  let length = 0;

  for (let index = 1; index < points.length; index += 1) {
    length += distance(points[index - 1], points[index]);
  }

  return length;
};

const interpolatePoint = <TPoint extends RecognitionPoint>(
  start: TPoint,
  end: TPoint,
  ratio: number,
): TPoint => {
  const interpolatedTime =
    start.t !== undefined && end.t !== undefined
      ? start.t + (end.t - start.t) * ratio
      : undefined;

  return {
    ...start,
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
    t: interpolatedTime,
    pressure:
      start.pressure !== undefined && end.pressure !== undefined
        ? start.pressure + (end.pressure - start.pressure) * ratio
        : start.pressure,
    tiltX:
      start.tiltX !== undefined && end.tiltX !== undefined
        ? start.tiltX + (end.tiltX - start.tiltX) * ratio
        : start.tiltX,
    tiltY:
      start.tiltY !== undefined && end.tiltY !== undefined
        ? start.tiltY + (end.tiltY - start.tiltY) * ratio
        : start.tiltY,
    twist:
      start.twist !== undefined && end.twist !== undefined
        ? start.twist + (end.twist - start.twist) * ratio
        : start.twist,
  };
};

export const resampleStroke = <TPoint extends RecognitionPoint>(
  points: readonly TPoint[],
  targetPointCount: number,
): TPoint[] => {
  const pointCount = Math.max(0, Math.floor(targetPointCount));

  if (pointCount === 0 || points.length === 0) {
    return [];
  }

  if (points.length === 1 || pointCount === 1) {
    return Array.from({ length: pointCount }, () => clonePoint(points[0]));
  }

  const pathLength = getStrokePathLength(points);

  if (pathLength === 0) {
    return Array.from({ length: pointCount }, () => clonePoint(points[0]));
  }

  const interval = pathLength / (pointCount - 1);
  const resampled: TPoint[] = [clonePoint(points[0])];
  let segmentStartIndex = 1;
  let distanceIntoSegment = 0;
  let previousPoint = points[0];

  while (segmentStartIndex < points.length && resampled.length < pointCount - 1) {
    const nextPoint = points[segmentStartIndex];
    const segmentLength = distance(previousPoint, nextPoint);

    if (segmentLength === 0) {
      previousPoint = nextPoint;
      segmentStartIndex += 1;
      continue;
    }

    if (distanceIntoSegment + segmentLength >= interval) {
      const remainingDistance = interval - distanceIntoSegment;
      const ratio = remainingDistance / segmentLength;
      const interpolated = interpolatePoint(previousPoint, nextPoint, ratio);
      resampled.push(interpolated);
      previousPoint = interpolated;
      distanceIntoSegment = 0;
    } else {
      distanceIntoSegment += segmentLength;
      previousPoint = nextPoint;
      segmentStartIndex += 1;
    }
  }

  const lastPoint = points[points.length - 1];
  while (resampled.length < pointCount) {
    resampled.push(clonePoint(lastPoint));
  }

  return resampled;
};

const allocatePointCounts = (
  strokeLengths: readonly number[],
  targetPointCount: number,
): number[] => {
  const nonEmptyCount = strokeLengths.filter((length) => length >= 0).length;
  const pointCount = Math.max(0, Math.floor(targetPointCount));

  if (nonEmptyCount === 0 || pointCount === 0) {
    return strokeLengths.map(() => 0);
  }

  if (pointCount <= nonEmptyCount) {
    let remaining = pointCount;
    return strokeLengths.map((length) => {
      if (remaining > 0 && length >= 0) {
        remaining -= 1;
        return 1;
      }

      return 0;
    });
  }

  const totalLength = strokeLengths.reduce((sum, length) => sum + Math.max(0, length), 0);
  const baseCounts: number[] = strokeLengths.map((length) => (length >= 0 ? 1 : 0));
  let remainingPoints = pointCount - nonEmptyCount;

  if (totalLength === 0) {
    let index = 0;
    while (remainingPoints > 0) {
      if (baseCounts[index] > 0) {
        baseCounts[index] += 1;
        remainingPoints -= 1;
      }
      index = (index + 1) % baseCounts.length;
    }

    return baseCounts;
  }

  const fractional = strokeLengths.map((length, index) => {
    const exact = (Math.max(0, length) / totalLength) * remainingPoints;
    const whole = Math.floor(exact);
    baseCounts[index] += whole;
    return { index, remainder: exact - whole };
  });

  let assigned = baseCounts.reduce((sum, count) => sum + count, 0);
  fractional
    .sort((a, b) => b.remainder - a.remainder)
    .forEach(({ index }) => {
      if (assigned < pointCount) {
        baseCounts[index] += 1;
        assigned += 1;
      }
    });

  return baseCounts;
};

export const resampleGlyph = <TStroke extends RecognitionStroke>(
  strokes: readonly TStroke[],
  totalPoints: number,
): TStroke[] => {
  const nonEmptyStrokes = strokes.filter((stroke) => stroke.points.length > 0);
  const strokeLengths = nonEmptyStrokes.map((stroke) => getStrokePathLength(stroke.points));
  const pointCounts = allocatePointCounts(strokeLengths, totalPoints);

  return nonEmptyStrokes.map((stroke, index) => ({
    ...stroke,
    points: resampleStroke(stroke.points, pointCounts[index]),
  }));
};
