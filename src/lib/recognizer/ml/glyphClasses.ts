import { activeRuneDefinitions } from "@/data/magicOntology";

export const glyphModelClassIds = activeRuneDefinitions
  .filter((rune) => rune.binding.type !== "casting_circle")
  .map((rune) => rune.templateId);

export const GLYPH_MODEL_UNKNOWN_CLASS = "UNKNOWN";

export const glyphModelOutputClassIds = [
  ...glyphModelClassIds,
  GLYPH_MODEL_UNKNOWN_CLASS,
] as const;
