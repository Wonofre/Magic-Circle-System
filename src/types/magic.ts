// ============================================
// Witch Hat Atelier Magic System
// Based on the manga/anime by Kamome Shirahama
// ============================================

/** The ten main sigils (elements) from Witch Hat Atelier */
export type SigilType =
  | 'fire'      // Triangle - flame shape
  | 'water'     // Wave / S-curve
  | 'earth'     // Square / rectangle
  | 'wind'      // Swoosh / curved arc
  | 'light'     // Five-pointed star
  | 'ice'       // Hexagon / snowflake
  | 'shadow'    // Crescent / blob
  | 'thunder'   // Zigzag / lightning bolt shape
  | 'nature'    // Leaf / spiral
  | 'void';     // Small closed circle

/** Signs (Keystones) - modifiers that determine how the spell manifests */
export type SignType =
  | 'column'        // Vertical beam - straight vertical line
  | 'dispersion'    // All-directions - star burst
  | 'levitation'    // Float upward - upward arc
  | 'direction'     // Aimed - arrow shape
  | 'convergence'   // Focused point - converging lines (Y/funnel)
  | 'bolt'          // Fast projectile - zigzag horizontal
  | 'rain'          // Falls from above - downward arcs
  | 'enlarge'       // Grows effect - closed rectangle
  | 'bird'          // Homing - two curved wings
  | 'weave'         // Ribbon / S-curve
  | 'pull'          // Attract - hook/crook
  | 'crush'         // Devastating - X cross
  | 'collection'    // Gather - inward spiral
  | 'billowing'     // Cloud barrier - bumpy curve
  | 'float'         // Defensive levitation - closed oval
  | 'shield_sign'   // Protective barrier - D shape / semicircle
  | 'heal_sign'     // Restorative - cross / plus shape
  | 'reflect'       // Mirror - diagonal slash pair
  | 'chain'         // Link - figure-8 / looping
  | 'explosion'     // Burst outward - star burst angular
  | 'spiral'        // Spiraling - inward or outward spiral
  | 'anchor';       // Ground - T-shape with curve at bottom

/** Glyph component drawn by the player */
export interface GlyphComponent {
  id: string;
  type: 'sigil' | 'sign' | 'ring';
  sigilType?: SigilType;
  signType?: SignType;
  points: Point[];
  center: Point;
  bounds: Bounds;
  precision: number;  // 0-100 how well it was drawn
  angle?: number;     // rotation angle for signs
  size: number;       // relative size
}

/** A point on the canvas */
export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

/** Bounding box */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Analysis result of a drawn stroke */
export interface StrokeAnalysis {
  isSigil: boolean;
  sigilType?: SigilType;
  isSign: boolean;
  signType?: SignType;
  isRing: boolean;
  precision: number;
  symmetry: number;     // 0-100 symmetry score
  center: Point;
  bounds: Bounds;
  points: Point[];
}

/** The complete magic circle (glyph) */
export interface Glyph {
  ring: GlyphComponent | null;
  sigils: GlyphComponent[];
  signs: GlyphComponent[];
  ringClosure: number;    // 0-100 how well the ring is closed
  ringPerfection: number; // 0-100 circle perfection
  symmetry: number;       // 0-100 overall symmetry
  proportion: number;     // 0-100 proportion score
}

/** Spell effect produced by a glyph */
export interface SpellEffect {
  element: SigilType;
  form: SignType;
  power: number;        // Base power
  potency: number;      // After modifications
  accuracy: number;     // How well aimed (0-100)
  area: 'single' | 'line' | 'cone' | 'area' | 'self';
  special?: string;     // Special effect description
}

/** A discovered/created spell */
export interface Spell {
  id: string;
  name: string;
  namePt: string;       // Portuguese name
  description: string;
  effects: SpellEffect[];
  glyphPattern: {       // What the glyph should contain
    sigils: SigilType[];
    signs: SignType[];
  };
  damage: number;
  healing: number;
  shield: number;
  discovered: boolean;
  useCount: number;
  tier: 1 | 2 | 3;      // Spell complexity tier
}

/** Combat entity */
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
  inkAffinity: SigilType | null;
  activeInfusionIds: readonly string[];
  element: SigilType | null;  // Elemental affinity
  weakness: SigilType | null; // Elemental weakness
  resistance: SigilType | null;
  status: StatusEffect[];
  isPlayer: boolean;
}

/** Status effect */
export interface StatusEffect {
  type: 'burn' | 'wet' | 'stun' | 'shield' | 'empower' | 'slow' | 'frozen' | 'cursed' | 'poisoned' | 'rooted';
  duration: number;
  potency: number;
}

/** Game phases */
export type GamePhase =
  | 'menu'
  | 'drawing'
  | 'evaluating'
  | 'casting'
  | 'enemy_turn'
  | 'victory'
  | 'defeat';

/** Game state */
export interface GameState {
  phase: GamePhase;
  player: Entity;
  enemy: Entity;
  turn: number;
  timeRemaining: number;
  currentGlyph: Glyph | null;
  lastSpell: Spell | null;
  lastDamage: number;
  combo: number;
  score: number;
}

/** Particle for visual effects */
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
  type: 'spark' | 'glow' | 'trail' | 'burst';
}

/** Drawing stroke from user input */
export interface DrawingStroke {
  id: string;
  points: Point[];
  timestamp: number;
}

/** Precision breakdown for feedback */
export interface PrecisionBreakdown {
  circlePerfection: number;
  ringClosure: number;
  sigilPrecision: number;
  signPrecision: number;
  symmetry: number;
  proportions: number;
  overall: number;
}
