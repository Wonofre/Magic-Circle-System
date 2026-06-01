import type { RecognitionStroke } from "@/types/recognition";

export const lineStrokeFixture: readonly RecognitionStroke[] = [
  {
    id: "fixture-line",
    timestamp: 0,
    points: [
      { x: 10, y: 10, t: 0 },
      { x: 50, y: 10, t: 50 },
      { x: 90, y: 10, t: 100 },
    ],
  },
];

export const roughCircleStrokeFixture: readonly RecognitionStroke[] = [
  {
    id: "fixture-rough-circle",
    timestamp: 0,
    points: [
      { x: 80, y: 50, t: 0 },
      { x: 70, y: 72, t: 40 },
      { x: 50, y: 82, t: 80 },
      { x: 28, y: 70, t: 120 },
      { x: 18, y: 50, t: 160 },
      { x: 30, y: 28, t: 200 },
      { x: 50, y: 18, t: 240 },
      { x: 72, y: 30, t: 280 },
      { x: 80, y: 50, t: 320 },
    ],
  },
];

export const duplicatePointStrokeFixture: readonly RecognitionStroke[] = [
  {
    id: "fixture-duplicates",
    timestamp: 0,
    points: [
      { x: 20, y: 20, t: 0, pressure: 0.5 },
      { x: 20, y: 20, t: 0, pressure: 0.5 },
      { x: 60, y: 60, t: 50, pressure: 0.7 },
      { x: 60, y: 60, t: 50, pressure: 0.7 },
      { x: 90, y: 90, t: 100, pressure: 0.6 },
    ],
  },
];

export const emptyStrokeFixture: readonly RecognitionStroke[] = [
  {
    id: "fixture-empty",
    timestamp: 0,
    points: [],
  },
];

export const scribbleStrokeFixture: readonly RecognitionStroke[] = [
  {
    id: "fixture-scribble",
    timestamp: 0,
    points: [
      { x: 20, y: 20, t: 0 },
      { x: 80, y: 80, t: 20 },
      { x: 20, y: 75, t: 40 },
      { x: 85, y: 25, t: 60 },
      { x: 12, y: 50, t: 80 },
      { x: 88, y: 52, t: 100 },
      { x: 30, y: 15, t: 120 },
      { x: 72, y: 90, t: 140 },
      { x: 15, y: 35, t: 160 },
      { x: 90, y: 70, t: 180 },
    ],
  },
];

export const openCircleStrokeFixture: readonly RecognitionStroke[] = [
  {
    id: "fixture-open-circle",
    timestamp: 0,
    points: [
      { x: 80, y: 50, t: 0 },
      { x: 70, y: 72, t: 40 },
      { x: 50, y: 82, t: 80 },
      { x: 28, y: 70, t: 120 },
      { x: 18, y: 50, t: 160 },
      { x: 30, y: 28, t: 200 },
      { x: 50, y: 18, t: 240 },
      { x: 65, y: 24, t: 280 },
    ],
  },
];

export const incompleteGlyphStrokeFixture: readonly RecognitionStroke[] = [
  {
    id: "fixture-incomplete-glyph",
    timestamp: 0,
    points: [
      { x: 50, y: 20, t: 0 },
      { x: 66, y: 62, t: 45 },
      { x: 50, y: 80, t: 90 },
    ],
  },
];

export const overtracedStrokeFixture: readonly RecognitionStroke[] = [
  {
    id: "fixture-overtraced",
    timestamp: 0,
    points: [
      { x: 18, y: 50, t: 0 },
      { x: 82, y: 50, t: 20 },
      { x: 18, y: 51, t: 40 },
      { x: 82, y: 49, t: 60 },
      { x: 18, y: 52, t: 80 },
      { x: 82, y: 48, t: 100 },
      { x: 18, y: 53, t: 120 },
      { x: 82, y: 47, t: 140 },
      { x: 18, y: 54, t: 160 },
      { x: 82, y: 46, t: 180 },
    ],
  },
];
