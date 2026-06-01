import type { CircleQuality, MandalaDocumentSource, MandalaSymbol } from "@/types/mandala";

export interface MandalaHashInput {
  readonly version: 1;
  readonly source?: MandalaDocumentSource;
  readonly circleQuality: CircleQuality;
  readonly symbols: readonly MandalaSymbol[];
  readonly formulaReading: string;
}

const bucketScore = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value / 5) * 5));

const hashString = (value: string): string => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `mandala_${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

export const getMandalaCanonicalShape = (input: MandalaHashInput): string =>
  JSON.stringify({
    version: input.version,
    circleQuality: {
      closure: bucketScore(input.circleQuality.closure),
      roundness: bucketScore(input.circleQuality.roundness),
      centeredness: bucketScore(input.circleQuality.centeredness),
      smoothness: bucketScore(input.circleQuality.smoothness),
      overall: bucketScore(input.circleQuality.overall),
    },
    symbols: input.symbols.map((symbol) => ({
      templateId: symbol.templateId,
      role: symbol.role,
      isDrawn: symbol.isDrawn,
      isDefault: symbol.isDefault,
      confidence: bucketScore(symbol.confidence * 100),
      position: symbol.position
        ? {
            angle: Math.round(symbol.position.angle),
            radius: bucketScore(symbol.position.radius),
            zone: symbol.position.zone,
          }
        : null,
    })),
    formulaReading: input.formulaReading,
  });

export const createMandalaHash = (input: MandalaHashInput): string =>
  hashString(getMandalaCanonicalShape(input));
