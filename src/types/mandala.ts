export type MandalaSymbolZone = "core" | "inner" | "middle" | "outer" | "orbital" | "frame";

export interface MandalaSymbolPosition {
  readonly angle: number;
  readonly radius: number;
  readonly zone: MandalaSymbolZone;
}
