import { getGlyphById } from "@/data/glyphTemplates";
import { getTemplateIdForLegacySigil } from "@/data/magicOntology";
import { compileSpellGraph } from "@/lib/recognizer/graphCompiler";
import { renderEnemySpellStrokes } from "@/lib/spell/enemyStrokeRenderer";
import type { Entity } from "@/types/magic";
import type { RecognitionStroke } from "@/types/recognition";
import type { SpellGraph } from "@/types/spellGraph";

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
  readonly graph: SpellGraph | null;
  readonly graphIssues: readonly string[];
  readonly strokes: readonly RecognitionStroke[];
}

export interface EnemySpellAIOptions {
  readonly turn?: number;
  readonly seed?: number;
}

const PROFILE_NOISE: Record<EnemySpellProfile, number> = {
  apprentice: 1.65,
  aggressive: 1.1,
  defensive: 0.95,
  control: 0.8,
  master: 0.38,
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
  if (enemy.element === "shadow" || enemy.element === "void") return "control";
  if (enemy.element === "earth" || enemy.element === "water" || enemy.element === "ice") return "defensive";
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

const getElementTemplateId = (enemy: Entity): string =>
  enemy.element ? getTemplateIdForLegacySigil(enemy.element) ?? "ELEMENT_UMBRA" : "ELEMENT_UMBRA";

const getTemplateIdsForIntent = (
  enemy: Entity,
  intent: EnemySpellIntent,
  profile: EnemySpellProfile,
): readonly string[] => {
  const frame = profile === "master" ? "FRAME_DOUBLE_SEAL" : "FRAME_CIRCLE_CONTAINMENT";
  const source = profile === "apprentice" ? "SOURCE_DOT" : "SOURCE_DOUBLE";
  const element = getElementTemplateId(enemy);

  switch (intent) {
    case "defense":
      return [frame, source, element, "ACTION_CONTAIN", "DEFENSE_SHIELD", "TARGET_SELF"];
    case "recover":
      return [frame, source, "ELEMENT_VITA", "ACTION_RESTORE", "FORM_AURA", "TARGET_SELF"];
    case "control":
      return [frame, source, element, "ACTION_SEAL", "FORM_CHAIN", "TARGET_ENEMY"];
    case "desperate":
      return [frame, source, element, "ACTION_EMIT", "FORM_BEAM", "TARGET_ENEMY", "RISK_BACKFLOW"];
    case "attack":
    default:
      return [frame, source, element, "ACTION_EMIT", "FORM_PROJECTILE", "TARGET_ENEMY"];
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
      return `${enemy.name} desenha ${style} uma barreira ligada ao proprio alvo.`;
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
  const graphResult = compileSpellGraph(
    templates.map((template) => ({
      template,
      confidence: profile === "apprentice" ? 0.72 : profile === "master" ? 0.96 : 0.86,
      recognitionOutcome: profile === "apprentice" ? "cast_weak" : "cast_clean",
    })),
  );
  const seed = options.seed ?? hashSeed(`${enemy.id}:${opponent.id}:${options.turn ?? 0}:${templateIds.join("|")}`);
  const strokes = renderEnemySpellStrokes(templates, {
    seed,
    noise: PROFILE_NOISE[profile],
  });

  return {
    profile,
    intent,
    templateIds,
    spellName: getIntentName(intent),
    effectText: getEffectText(enemy, intent, profile),
    expectedInkCost: intent === "desperate" ? 4 : intent === "attack" || intent === "control" ? 3 : 2,
    expectedPower: estimatePower(intent, profile),
    graph: graphResult.ok ? graphResult.graph : null,
    graphIssues: graphResult.issues.map((issue) => issue.message),
    strokes,
  };
};
