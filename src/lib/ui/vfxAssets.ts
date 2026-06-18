import type { ElementSigilId } from "@/types/magicFormulaV2";

export interface VfxTextureSet {
  readonly bloom: string;
  readonly burst: string;
  readonly impact: string;
  readonly seal: string;
}

const asset = (name: string): string => `/assets/vfx/${name}`;

export const vfxSharedTextures = {
  inkBloom: asset("vfx-ink-bloom.jpg"),
  impactFlash: asset("vfx-impact-flash.jpg"),
  sealRing: asset("vfx-seal-ring.jpg"),
  fizzleBurst: asset("vfx-fizzle-burst.jpg"),
} as const;

const elementBurstById: Partial<Record<ElementSigilId, string>> = {
  IGNIS: asset("vfx-ignis-burst.jpg"),
  AQUA: asset("vfx-aqua-burst.jpg"),
  TERRA: asset("vfx-terra-burst.jpg"),
  LUX: asset("vfx-lux-burst.jpg"),
  UMBRA: asset("vfx-umbra-burst.jpg"),
  FULMEN: asset("vfx-fulmen-burst.jpg"),
  GELU: asset("vfx-gelu-burst.jpg"),
  VENTUS: asset("vfx-ventus-burst.jpg"),
  VITA: asset("vfx-vita-burst.jpg"),
  SANGUIS: asset("vfx-sanguis-burst.jpg"),
  MENS: asset("vfx-mens-burst.jpg"),
};

export const getElementBurstTexture = (
  element: ElementSigilId | "neutral",
): string =>
  element === "neutral"
    ? vfxSharedTextures.inkBloom
    : elementBurstById[element] ?? vfxSharedTextures.inkBloom;

export const getVfxTextureSet = (
  element: ElementSigilId | "neutral",
  isSuccess: boolean,
): VfxTextureSet => ({
  bloom: isSuccess ? vfxSharedTextures.inkBloom : vfxSharedTextures.fizzleBurst,
  burst: isSuccess ? getElementBurstTexture(element) : vfxSharedTextures.fizzleBurst,
  impact: vfxSharedTextures.impactFlash,
  seal: vfxSharedTextures.sealRing,
});