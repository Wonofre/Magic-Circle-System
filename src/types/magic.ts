import type { ElementSigilId, MagicKeyId } from "@/types/magicFormulaV2";

export interface Point {
  x: number;
  y: number;
  t?: number;
  pressure?: number;
  tangentialPressure?: number;
  tiltX?: number;
  tiltY?: number;
  twist?: number;
  altitudeAngle?: number;
  azimuthAngle?: number;
  pointerType?: string;
}

export interface SpellEffect {
  element: ElementSigilId;
  form: MagicKeyId;
  power: number;
  potency: number;
  accuracy: number;
  area: "single" | "line" | "cone" | "area" | "self";
  statusEffects?: readonly StatusEffect[];
  fieldEffect?: BattlefieldEffect;
  shieldBypassRatio?: number;
  dispelPower?: number;
  special?: string;
}

export interface Entity {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  shield: number;
  ink: number;
  maxInk: number;
  inkRegenPerTurn: number;
  inkPurity: number;
  inkViscosity: number;
  inkVolatility: number;
  inkAffinity: ElementSigilId | null;
  activeInfusionIds: readonly string[];
  element: ElementSigilId | null;
  weakness: ElementSigilId | null;
  resistance: ElementSigilId | null;
  status: StatusEffect[];
  isPlayer: boolean;
}

export interface StatusEffect {
  type:
    | "burn"
    | "wet"
    | "stun"
    | "shield"
    | "empower"
    | "slow"
    | "frozen"
    | "cursed"
    | "poisoned"
    | "rooted"
    | "blinded"
    | "revealed"
    | "bleeding"
    | "confused"
    | "regeneration";
  duration: number;
  potency: number;
}

export interface BattlefieldEffect {
  id: string;
  type:
    | "rain"
    | "ignited"
    | "stonewall"
    | "gust"
    | "revelation"
    | "shadow_veil"
    | "life_surge"
    | "frozen_ground"
    | "storm_charge"
    | "blood_mark"
    | "mind_haze"
    | "trap_zone";
  element: ElementSigilId | null;
  duration: number;
  potency: number;
}

export type GamePhase =
  | "menu"
  | "drawing"
  | "evaluating"
  | "casting"
  | "enemy_turn"
  | "victory"
  | "defeat";

export interface GameState {
  phase: GamePhase;
  player: Entity;
  enemy: Entity;
  turn: number;
  timeRemaining: number;
  lastDamage: number;
  combo: number;
  score: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: "spark" | "glow" | "trail" | "burst";
}

export interface DrawingStroke {
  id: string;
  points: Point[];
  timestamp: number;
  rawClosureDistance?: number;
}

export interface PrecisionBreakdown {
  castingCircleQuality: number;
  castingCircleClosure: number;
  sigilPrecision: number;
  keyPrecision: number;
  symmetry: number;
  proportions: number;
  overall: number;
}
