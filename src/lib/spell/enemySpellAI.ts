import { getGlyphById } from "@/data/glyphTemplates";
import { activeRuneDefinitions } from "@/data/magicOntology";
import { parseMandalaV2FromStrokes } from "@/lib/recognizerV2/mandalaParserV2";
import { renderEnemySpellStrokes } from "@/lib/spell/enemyStrokeRenderer";
import { buildFormulaGraphV2 } from "@/lib/spellV2/formulaGraphV2";
import { compileMagicFormulaV2 } from "@/lib/spellV2/formulaCompilerV2";
import type { Entity } from "@/types/magic";
import type { ElementSigilId, FormulaGraphV2 } from "@/types/magicFormulaV2";
import type { RecognitionStroke } from "@/types/recognition";

export type EnemySpellProfile =
  | "apprentice"
  | "aggressive"
  | "defensive"
  | "control"
  | "master";

export type EnemySpellIntent = "attack" | "defense" | "control" | "recover" | "desperate";

export interface EnemySpellPlan {
  readonly profile: EnemySpellProfile;
  readonly intent: EnemySpellIntent;
  readonly templateIds: readonly string[];
  readonly spellName: string;
  readonly effectText: string;
  readonly expectedInkCost: number;
  readonly expectedPower: number;
  readonly graph: FormulaGraphV2 | null;
  readonly formulaIssues: readonly string[];
  readonly strokes: readonly RecognitionStroke[];
}

export interface EnemySpellAIOptions {
  readonly turn?: number;
  readonly seed?: number;
}

const PROFILE_NOISE: Record<EnemySpellProfile, number> = {
  apprentice: 0.72,
  aggressive: 0.58,
  defensive: 0.46,
  control: 0.4,
  master: 0.18,
};

const getRoundFromEnemy = (enemy: Entity): number => {
  const match = enemy.id.match(/\d+/);
  return match ? Number(match[0]) : 1;
};

const hashSeed = (value: string): number => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
};

export const getEnemySpellProfile = (enemy: Entity): EnemySpellProfile => {
  const round = getRoundFromEnemy(enemy);

  if (round >= 10) return "master";
  if (enemy.hp < enemy.maxHp * 0.32) return "aggressive";
  if (enemy.element === "UMBRA" || enemy.element === "MENS") return "control";
  if (enemy.element === "TERRA" || enemy.element === "AQUA" || enemy.element === "GELU") return "defensive";
  if (round <= 2) return "apprentice";
  return "aggressive";
};

const chooseIntent = (
  enemy: Entity,
  opponent: Entity,
  profile: EnemySpellProfile,
): EnemySpellIntent => {
  if (enemy.hp < enemy.maxHp * 0.28) return "desperate";
  if (enemy.hp < enemy.maxHp * 0.5 && (profile === "defensive" || enemy.ink < 4)) return "defense";
  if (opponent.shield > 10 || profile === "control") return "control";
  if (profile === "defensive" && enemy.shield < 8) return "defense";
  if (profile === "apprentice" && enemy.hp < enemy.maxHp * 0.7) return "recover";
  return "attack";
};

const elementTemplateIds = new Map<ElementSigilId, string>(
  activeRuneDefinitions.flatMap((rune) =>
    rune.binding.type === "sigil" ? [[rune.binding.sigilId, rune.templateId] as const] : [],
  ),
);

const getElementTemplateId = (enemy: Entity): string =>
  enemy.element ? elementTemplateIds.get(enemy.element) ?? "ELEMENT_UMBRA" : "ELEMENT_UMBRA";

const getTemplateIdsForIntent = (
  enemy: Entity,
  intent: EnemySpellIntent,
  profile: EnemySpellProfile,
): readonly string[] => {
  const frame = profile === "master" ? "FRAME_DOUBLE_SEAL" : "FRAME_CIRCLE_CONTAINMENT";
  const element = getElementTemplateId(enemy);

  switch (intent) {
    case "defense":
      return [frame, element, "ACTION_CONTAIN", "DEFENSE_SHIELD"];
    case "recover":
      return [frame, "ELEMENT_VITA", "ACTION_RESTORE", "FORM_AURA"];
    case "control":
      return [frame, element, "ACTION_SEAL", "FORM_CHAIN"];
    case "desperate":
      return [frame, element, "ACTION_EMIT", "FORM_BEAM", "RISK_BACKFLOW"];
    case "attack":
    default:
      return [frame, element, "ACTION_EMIT", "FORM_PROJECTILE"];
  }
};

const getIntentName = (intent: EnemySpellIntent): string => {
  switch (intent) {
    case "defense":
      return "Selo de Guarda";
    case "recover":
      return "Sutura Vital";
    case "control":
      return "Vinculo de Contencao";
    case "desperate":
      return "Descarga Instavel";
    case "attack":
    default:
      return "Projetil Arcano";
  }
};

const getEffectText = (
  enemy: Entity,
  intent: EnemySpellIntent,
  profile: EnemySpellProfile,
): string => {
  const style = profile === "master" ? "com linhas precisas" : profile === "apprentice" ? "com traco irregular" : "com ritmo firme";

  switch (intent) {
    case "defense":
      return `${enemy.name} desenha ${style} uma barreira ao redor de si.`;
    case "recover":
      return `${enemy.name} costura uma aura de recuperacao ${style}.`;
    case "control":
      return `${enemy.name} prende o fluxo em uma corrente de controle ${style}.`;
    case "desperate":
      return `${enemy.name} sobrecarrega o circulo ${style}; a tinta ameaca voltar.`;
    case "attack":
    default:
      return `${enemy.name} projeta um ataque ${style} usando o mesmo vocabulario de glifos.`;
  }
};

const estimatePower = (intent: EnemySpellIntent, profile: EnemySpellProfile): number => {
  const profileBonus = profile === "master" ? 10 : profile === "apprentice" ? -3 : 3;

  switch (intent) {
    case "defense":
      return 12 + profileBonus;
    case "recover":
      return 10 + profileBonus;
    case "control":
      return 14 + profileBonus;
    case "desperate":
      return 24 + profileBonus;
    case "attack":
    default:
      return 18 + profileBonus;
  }
};

export const chooseEnemySpellPlan = (
  enemy: Entity,
  opponent: Entity,
  options: EnemySpellAIOptions = {},
): EnemySpellPlan => {
  const profile = getEnemySpellProfile(enemy);
  const intent = chooseIntent(enemy, opponent, profile);
  const templateIds = getTemplateIdsForIntent(enemy, intent, profile);
  const templates = templateIds.map((id) => getGlyphById(id)).filter((template) => template !== undefined);
  const seed = options.seed ?? hashSeed(`${enemy.id}:${opponent.id}:${options.turn ?? 0}:${templateIds.join("|")}`);
  const strokes = renderEnemySpellStrokes(templates, {
    seed,
    noise: PROFILE_NOISE[profile],
  });
  const formula = compileMagicFormulaV2(parseMandalaV2FromStrokes(strokes));
  const graph = formula.validity === "invalid" ? null : buildFormulaGraphV2(formula);

  return {
    profile,
    intent,
    templateIds,
    spellName: getIntentName(intent),
    effectText: getEffectText(enemy, intent, profile),
    expectedInkCost: intent === "desperate" ? 4 : intent === "attack" || intent === "control" ? 3 : 2,
    expectedPower: estimatePower(intent, profile),
    graph,
    formulaIssues: formula.issues.map((issue) => issue.code),
    strokes,
  };
};
