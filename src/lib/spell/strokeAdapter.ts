import type { DrawingStroke } from "@/types/magic";
import type { RecognitionStroke } from "@/types/recognition";

const relativeTime = (timestamp: number, fallback: number): number =>
  Number.isFinite(timestamp) ? Math.max(0, timestamp) : fallback;

export const drawingStrokesToRecognitionStrokes = (
  strokes: readonly DrawingStroke[],
): readonly RecognitionStroke[] =>
  strokes.map((stroke) => {
    const strokeStart = stroke.points[0]?.t ?? stroke.timestamp;

    return {
      id: stroke.id,
      timestamp: stroke.timestamp,
      points: stroke.points.map((point, pointIndex) => ({
        x: point.x,
        y: point.y,
        t: typeof point.t === "number"
          ? relativeTime(point.t - strokeStart, pointIndex)
          : pointIndex,
        pressure: point.pressure,
        tangentialPressure: point.tangentialPressure,
        tiltX: point.tiltX,
        tiltY: point.tiltY,
        twist: point.twist,
        altitudeAngle: point.altitudeAngle,
        azimuthAngle: point.azimuthAngle,
        pointerType: point.pointerType,
      })),
    };
  });

export const hasPointerDynamics = (strokes: readonly RecognitionStroke[]): boolean =>
  strokes.some((stroke) =>
    stroke.points.some((point) =>
      typeof point.pressure === "number" ||
      typeof point.tiltX === "number" ||
      typeof point.tiltY === "number" ||
      typeof point.twist === "number" ||
      typeof point.pointerType === "string",
    ),
  );
