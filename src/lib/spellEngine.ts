import type { SigilType, SignType, Spell, SpellEffect, Entity, StatusEffect } from '@/types/magic';
import type { InkCostBreakdown } from '@/types/ink';
import { SIGILS, SIGNS } from './magicSystem';
import { calculateLegacySpellInkCost, DEFAULT_ENEMY_INK, simulateInkSpend } from './spell/inkSimulator';

// ============================================
// ELEMENTAL INTERACTIONS
// ============================================

export const ELEMENTAL_ADVANTAGE: Record<SigilType, SigilType[]> = {
  fire:    ['wind', 'nature', 'ice'],
  wind:    ['earth', 'nature'],
  earth:   ['water', 'thunder', 'void'],
  water:   ['fire', 'thunder'],
  light:   ['shadow', 'void'],
  ice:     ['nature', 'wind'],
  shadow:  ['light', 'void'],
  thunder: ['water', 'ice'],
  nature:  ['earth', 'water'],
  void:    ['light', 'fire', 'ice'],
};

export const ELEMENTAL_WEAKNESS: Record<SigilType, SigilType[]> = {
  fire:    ['water', 'ice', 'void'],
  water:   ['earth', 'thunder', 'nature'],
  earth:   ['wind', 'nature'],
  wind:    ['fire', 'ice', 'thunder'],
  light:   ['shadow', 'void'],
  ice:     ['fire', 'thunder'],
  shadow:  ['light'],
  thunder: ['earth'],
  nature:  ['fire', 'ice', 'shadow'],
  void:    ['light', 'shadow'],
};

export function getElementalMultiplier(attacker: SigilType, defenderWeakness: SigilType | null): number {
  if (!defenderWeakness) return 1.0;
  if (ELEMENTAL_ADVANTAGE[attacker]?.includes(defenderWeakness)) return 1.6;
  if (ELEMENTAL_WEAKNESS[attacker]?.includes(defenderWeakness)) return 0.5;
  if (attacker === defenderWeakness) return 0.75;
  return 1.0;
}

export function getWeaknessMultiplier(attacker: SigilType, defenderWeakness: SigilType | null): number {
  if (!defenderWeakness) return 1.0;
  if (attacker === defenderWeakness) return 1.8;
  return 1.0;
}

// ============================================
// SIGN EFFECT MAPPING
// ============================================

interface SignEffect {
  damageMod: number;
  healMod: number;
  shieldMod: number;
  accuracyMod: number;
  area: SpellEffect['area'];
  special?: string;
  status?: StatusEffect;
}

export const SIGN_EFFECTS: Record<SignType, SignEffect> = {
  column:      { damageMod: 1.4,  healMod: 0.8,  shieldMod: 0.5, accuracyMod: 5,   area: 'line',   special: 'Feixe poderoso e penetrante' },
  dispersion:  { damageMod: 0.7,  healMod: 0.7,  shieldMod: 0.7, accuracyMod: -10, area: 'area',   special: 'Atinge todos ao redor' },
  levitation:  { damageMod: 0.7,  healMod: 1.2,  shieldMod: 1.5, accuracyMod: 5,   area: 'single', special: 'Eleva e protege' },
  direction:   { damageMod: 1.0,  healMod: 1.0,  shieldMod: 1.0, accuracyMod: 20,  area: 'line',   special: 'Precisão máxima' },
  convergence: { damageMod: 1.6,  healMod: 0.6,  shieldMod: 0.6, accuracyMod: -5,  area: 'single', special: 'Foco letal concentrado' },
  bolt:        { damageMod: 1.25, healMod: 0.5,  shieldMod: 0.5, accuracyMod: 12,  area: 'line',   special: 'Projétil veloz e certeiro' },
  rain:        { damageMod: 0.55, healMod: 0.8,  shieldMod: 0.5, accuracyMod: 0,   area: 'area',   special: 'Cobre toda a área', status: { type: 'wet', duration: 3, potency: 5 } },
  enlarge:     { damageMod: 1.45, healMod: 1.45, shieldMod: 1.45,accuracyMod: -8,  area: 'single', special: 'Amplifica o efeito' },
  bird:        { damageMod: 1.15, healMod: 0.8,  shieldMod: 0.5, accuracyMod: 25,  area: 'single', special: 'Persegue o alvo até acertar' },
  weave:       { damageMod: 0.6,  healMod: 0.5,  shieldMod: 0.8, accuracyMod: 10,  area: 'single', special: 'Restringe o movimento', status: { type: 'slow', duration: 2, potency: 15 } },
  pull:        { damageMod: 0.9,  healMod: 0.5,  shieldMod: 0.6, accuracyMod: 5,   area: 'cone',   special: 'Puxa inimigos para perto' },
  crush:       { damageMod: 1.75, healMod: 0.3,  shieldMod: 0.3, accuracyMod: -18, area: 'single', special: 'Impacto absolutamente devastador' },
  collection:  { damageMod: 1.0,  healMod: 1.3,  shieldMod: 1.3, accuracyMod: 0,   area: 'single', special: 'Absorve energia do ambiente' },
  billowing:   { damageMod: 0.35, healMod: 0.5,  shieldMod: 2.0, accuracyMod: 0,   area: 'self',   special: 'Barreira protetora de névoa' },
  float:       { damageMod: 0.5,  healMod: 0.8,  shieldMod: 1.8, accuracyMod: 10,  area: 'self',   special: 'Levitação defensiva' },
  shield_sign: { damageMod: 0.3,  healMod: 0.5,  shieldMod: 2.5, accuracyMod: 0,   area: 'self',   special: 'Muralha mágica sólida' },
  heal_sign:   { damageMod: 0.2,  healMod: 2.5,  shieldMod: 1.0, accuracyMod: 0,   area: 'self',   special: 'Restauração completa' },
  reflect:     { damageMod: 0.8,  healMod: 0.5,  shieldMod: 1.5, accuracyMod: 0,   area: 'self',   special: 'Devolve parte do dano' },
  chain:       { damageMod: 0.8,  healMod: 0.3,  shieldMod: 0.5, accuracyMod: 5,   area: 'single', special: 'Imobiliza completamente', status: { type: 'stun', duration: 2, potency: 100 } },
  explosion:   { damageMod: 1.8,  healMod: 0.2,  shieldMod: 0.2, accuracyMod: -20, area: 'area',   special: 'Explosão devastadora em área' },
  spiral:      { damageMod: 1.3,  healMod: 1.3,  shieldMod: 1.3, accuracyMod: 0,   area: 'area',   special: 'Poder que cresce em espiral' },
  anchor:      { damageMod: 0.8,  healMod: 1.0,  shieldMod: 1.5, accuracyMod: 10,  area: 'single', special: 'Efeito estável e duradouro' },
};

// ============================================
// BASE STATS BY ELEMENT
// ============================================

export const BASE_DAMAGE: Record<SigilType, number> = {
  fire:    20,
  water:   14,
  earth:   16,
  wind:    15,
  light:   22,
  ice:     18,
  shadow:  17,
  thunder: 24,
  nature:  13,
  void:    28,
};

export const BASE_HEALING: Record<SigilType, number> = {
  fire:    0,
  water:   14,
  earth:   4,
  wind:    3,
  light:   18,
  ice:     5,
  shadow:  2,
  thunder: 0,
  nature:  20,
  void:    8,
};

export const BASE_SHIELD: Record<SigilType, number> = {
  fire:    0,
  water:   6,
  earth:   18,
  wind:    5,
  light:   10,
  ice:     14,
  shadow:  6,
  thunder: 0,
  nature:  8,
  void:    12,
};

// ============================================
// COMBINATION BONUSES
// ============================================

export function calculateCombinationBonus(
  sigils: SigilType[],
  signs: SignType[],
  precision: number
): { damageBonus: number; nameBonus: string; description: string } {
  let damageBonus = 1.0;
  let nameBonus = '';
  let description = '';

  if (sigils.length >= 2) {
    const u = [...new Set(sigils)];

    const combos: { a: SigilType; b: SigilType; bonus: number; name: string; desc: string }[] = [
      { a: 'fire',    b: 'wind',    bonus: 0.45, name: ' Explosivo',     desc: 'O vento alimenta as chamas!' },
      { a: 'water',   b: 'wind',    bonus: 0.40, name: ' Tempestuoso',   desc: 'Uma tempestade se forma!' },
      { a: 'fire',    b: 'earth',   bonus: 0.50, name: ' Magma',         desc: 'A terra derrete em magma!' },
      { a: 'water',   b: 'earth',   bonus: 0.30, name: ' da Natureza',   desc: 'A vida brota do barro!' },
      { a: 'fire',    b: 'light',   bonus: 0.55, name: ' Solar',         desc: 'O calor do sol em forma pura!' },
      { a: 'water',   b: 'light',   bonus: 0.35, name: ' Prismático',    desc: 'A luz refrata pela água!' },
      { a: 'ice',     b: 'wind',    bonus: 0.45, name: ' Ventania Ártica',desc: 'Geada cortante no vento!' },
      { a: 'thunder', b: 'water',   bonus: 0.50, name: ' Tempestade',    desc: 'Tempestade elétrica!' },
      { a: 'shadow',  b: 'void',    bonus: 0.60, name: ' do Abismo',     desc: 'O vazio absorve as sombras!' },
      { a: 'nature',  b: 'water',   bonus: 0.35, name: ' Luxuriante',    desc: 'A floresta floresce!' },
      { a: 'light',   b: 'thunder', bonus: 0.55, name: ' Divino',        desc: 'Luz e raio em harmonia sagrada!' },
      { a: 'fire',    b: 'shadow',  bonus: 0.40, name: ' Sombrio',       desc: 'Chama das trevas!' },
      { a: 'ice',     b: 'nature',  bonus: 0.40, name: ' Invernal',      desc: 'O inverno congela a floresta!' },
      { a: 'void',    b: 'shadow',  bonus: 0.65, name: ' do Caos',       desc: 'Vazio e sombra destroem tudo!' },
      { a: 'thunder', b: 'wind',    bonus: 0.45, name: ' Elétrico',      desc: 'Tempestade de raios!' },
    ];

    for (const combo of combos) {
      if (u.includes(combo.a) && u.includes(combo.b)) {
        damageBonus += combo.bonus;
        nameBonus = combo.name;
        description = combo.desc;
        break; // Only first matching combo
      }
    }

    if (u.length >= 4) {
      damageBonus += 0.65;
      nameBonus = ' Elemental Supremo';
      description = 'Todos os elementos em harmonia!';
    }
  }

  if (signs.length >= 2) {
    damageBonus += signs.length * 0.12;
    description += description ? ` ${signs.length} chaves sinergizam!` : `${signs.length} chaves sinergizam!`;
  }

  if (precision >= 90) {
    damageBonus += 0.30;
    description += ' Desenho perfeito!';
  } else if (precision >= 75) {
    damageBonus += 0.15;
  } else if (precision >= 55) {
    damageBonus += 0.05;
  }

  return { damageBonus, nameBonus, description };
}

// ============================================
// SPELL NAME GENERATOR
// ============================================

const SIGIL_FLAVOR: Record<SigilType, { essence: string; adjective: string; verb: string }> = {
  fire:    { essence: 'Chamas', adjective: 'Ardente', verb: 'queima' },
  water:   { essence: 'Marés', adjective: 'Fluida', verb: 'flui' },
  earth:   { essence: 'Pedra', adjective: 'Granítica', verb: 'sustenta' },
  wind:    { essence: 'Vendaval', adjective: 'Cortante', verb: 'rasga' },
  light:   { essence: 'Luz', adjective: 'Radiante', verb: 'purifica' },
  ice:     { essence: 'Cristal', adjective: 'Glacial', verb: 'congela' },
  shadow:  { essence: 'Sombra', adjective: 'Oculta', verb: 'drena' },
  thunder: { essence: 'Trovão', adjective: 'Fulminante', verb: 'fulmina' },
  nature:  { essence: 'Raízes', adjective: 'Viva', verb: 'floresce' },
  void:    { essence: 'Vazio', adjective: 'Abissal', verb: 'colapsa' },
};

const SIGN_FLAVOR: Record<SignType, { form: string; action: string; reward: string }> = {
  column:      { form: 'Coluna', action: 'concentra energia em linha reta', reward: 'impacto direto' },
  dispersion:  { form: 'Dispersão', action: 'espalha o poder em múltiplas direções', reward: 'area ampliada' },
  levitation:  { form: 'Orbe Ascendente', action: 'eleva e estabiliza o fluxo', reward: 'controle leve' },
  direction:   { form: 'Seta', action: 'corrige a trajetória do feitiço', reward: 'mira precisa' },
  convergence: { form: 'Foco', action: 'aperta todo o poder em um ponto', reward: 'perfuração' },
  bolt:        { form: 'Dardo', action: 'dispara uma descarga veloz', reward: 'velocidade' },
  rain:        { form: 'Chuva', action: 'faz cair energia sobre a arena', reward: 'cobertura' },
  enlarge:     { form: 'Ampliação', action: 'engrossa o círculo interno', reward: 'potência' },
  bird:        { form: 'Ave', action: 'dá instinto de perseguição ao golpe', reward: 'busca' },
  weave:       { form: 'Trama', action: 'costura linhas que prendem o alvo', reward: 'restrição' },
  pull:        { form: 'Gancho', action: 'puxa energia e inimigos para dentro', reward: 'atração' },
  crush:       { form: 'Martelo', action: 'fecha o símbolo em pressão brutal', reward: 'ruptura' },
  collection:  { form: 'Coleta', action: 'absorve energia solta ao redor', reward: 'recarga' },
  billowing:   { form: 'Névoa', action: 'espalha uma camada protetora', reward: 'barreira macia' },
  float:       { form: 'Elipse', action: 'mantém o fluxo suspenso', reward: 'defesa móvel' },
  shield_sign: { form: 'Escudo', action: 'dobra o fluxo em proteção', reward: 'bloqueio' },
  heal_sign:   { form: 'Sutura', action: 'costura energia vital', reward: 'cura' },
  reflect:     { form: 'Espelho', action: 'devolve parte da força recebida', reward: 'reflexão' },
  chain:       { form: 'Corrente', action: 'amarra o efeito em laços duplos', reward: 'prisão' },
  explosion:   { form: 'Estouro', action: 'libera tudo de uma vez', reward: 'explosão' },
  spiral:      { form: 'Espiral', action: 'faz o poder girar e crescer', reward: 'escalada' },
  anchor:      { form: 'Âncora', action: 'fixa a magia no chão', reward: 'estabilidade' },
};

export function generateSpellName(
  sigils: SigilType[],
  signs: SignType[],
  nameBonus: string
): string {
  if (sigils.length === 0) return 'Magia Falha';

  const primarySigil = sigils[0];
  const sigilData = SIGILS[primarySigil];

  if (signs.length === 0) {
    return `${sigilData.namePt} Puro${nameBonus}`;
  }

  const primarySign = signs[0];

  const combos: Record<string, string> = {
    // Fire combos
    'fire-column':      'Coluna de Fogo',
    'fire-dispersion':  'Explosão de Fogo',
    'fire-bolt':        'Projétil Ígneo',
    'fire-rain':        'Chuva de Brasas',
    'fire-enlarge':     'Inferno Amplificado',
    'fire-crush':       'Martelo de Chamas',
    'fire-explosion':   'Grande Explosão',
    'fire-spiral':      'Espiral Ardente',
    'fire-bird':        'Fênix de Fogo',
    // Water combos
    'water-column':     'Jato d\'Água',
    'water-dispersion': 'Onda Expansiva',
    'water-levitation': 'Orbe de Água',
    'water-rain':       'Dilúvio',
    'water-bolt':       'Raio Aquático',
    'water-billowing':  'Muralha de Névoa',
    'water-heal_sign':  'Cura das Águas',
    'water-shield_sign':'Escudo Aquático',
    // Earth combos
    'earth-column':     'Pilar de Terra',
    'earth-enlarge':    'Montanha Crescente',
    'earth-crush':      'Esmagamento Terreno',
    'earth-dispersion': 'Areia Movediça',
    'earth-shield_sign':'Muralha de Pedra',
    'earth-anchor':     'Âncora Granítica',
    // Wind combos
    'wind-column':      'Tornado',
    'wind-bolt':        'Lâmina de Vento',
    'wind-bird':        'Falcão de Vento',
    'wind-direction':   'Rajada Direcionada',
    'wind-dispersion':  'Furacão',
    'wind-spiral':      'Vórtice',
    // Light combos
    'light-column':     'Feixe de Luz',
    'light-dispersion': 'Clarão Ofuscante',
    'light-convergence':'Concentração Luminosa',
    'light-bird':       'Fênix de Luz',
    'light-enlarge':    'Supernova',
    'light-rain':       'Chuva Estelar',
    'light-heal_sign':  'Benção Sagrada',
    'light-shield_sign':'Escudo Divino',
    // Ice combos
    'ice-column':       'Lança de Gelo',
    'ice-dispersion':   'Tempestade de Neve',
    'ice-bolt':         'Seta de Cristal',
    'ice-rain':         'Granizo',
    'ice-enlarge':      'Glacier',
    'ice-chain':        'Correntes de Gelo',
    'ice-shield_sign':  'Escudo de Cristal',
    // Shadow combos
    'shadow-bolt':      'Dardo das Sombras',
    'shadow-dispersion':'Nuvem Sombria',
    'shadow-convergence':'Toque das Trevas',
    'shadow-weave':     'Tentáculos Sombrios',
    'shadow-chain':     'Correntes da Escuridão',
    // Thunder combos
    'thunder-column':   'Relâmpago',
    'thunder-bolt':     'Descarga Elétrica',
    'thunder-dispersion':'Tempestade Elétrica',
    'thunder-explosion':'Trovão Devastador',
    'thunder-rain':     'Chuva de Raios',
    // Nature combos
    'nature-weave':     'Raízes Enredantes',
    'nature-collection':'Síntese Natural',
    'nature-dispersion':'Esporos de Veneno',
    'nature-heal_sign': 'Cura da Floresta',
    'nature-anchor':    'Raiz Profunda',
    'nature-rain':      'Chuva de Pétalas',
    // Void combos
    'void-convergence': 'Singularidade',
    'void-dispersion':  'Ruptura Dimensional',
    'void-crush':       'Colapso Gravitacional',
    'void-column':      'Feixe do Vazio',
    'void-explosion':   'Implosão',
    'void-spiral':      'Vórtice Dimensional',
  };

  const key = `${primarySigil}-${primarySign}`;
  if (combos[key]) {
    return combos[key] + nameBonus;
  }

  const sigilFlavor = SIGIL_FLAVOR[primarySigil];
  const signFlavor = SIGN_FLAVOR[primarySign];
  const extraSigils = sigils.slice(1).map(s => SIGIL_FLAVOR[s].adjective).join(' ');
  const extraSigns = signs.slice(1).map(s => SIGN_FLAVOR[s].form).join(' ');
  const suffix = [extraSigils, extraSigns].filter(Boolean).join(' ');

  return `${signFlavor.form} de ${sigilFlavor.essence}${nameBonus}${suffix ? ` ${suffix}` : ''}`;
}

export function getSpellPatternId(sigils: SigilType[], signs: SignType[]): string {
  const sigilPart = [...sigils].sort().join('-') || 'none';
  const signPart = [...signs].sort().join('-') || 'pure';
  return `${sigilPart}__${signPart}`;
}

export function spellMatchesPattern(spell: Spell, sigils: SigilType[], signs: SignType[]): boolean {
  return getSpellPatternId(spell.glyphPattern.sigils, spell.glyphPattern.signs) === getSpellPatternId(sigils, signs);
}

export function getProceduralTier(sigils: SigilType[], signs: SignType[], precision = 60): 1 | 2 | 3 {
  const complexity = new Set(sigils).size + new Set(signs).size;
  if (complexity >= 4 || precision >= 88) return 3;
  if (complexity >= 3 || precision >= 68) return 2;
  return 1;
}

function estimateSpellStats(sigils: SigilType[], signs: SignType[], precision = 70) {
  const activeSign = signs[0] ?? 'column';
  const signEffect = SIGN_EFFECTS[activeSign];
  const precisionFactor = Math.max(0.35, precision / 100);
  const combo = calculateCombinationBonus(sigils, signs, precision).damageBonus;

  const raw = sigils.reduce((totals, sigil) => ({
    damage: totals.damage + BASE_DAMAGE[sigil] * signEffect.damageMod,
    healing: totals.healing + BASE_HEALING[sigil] * signEffect.healMod,
    shield: totals.shield + BASE_SHIELD[sigil] * signEffect.shieldMod,
  }), { damage: 0, healing: 0, shield: 0 });

  return {
    damage: Math.round(raw.damage * precisionFactor * combo),
    healing: Math.round(raw.healing * precisionFactor * combo),
    shield: Math.round(raw.shield * precisionFactor * combo),
  };
}

export function describeProceduralEffect(sigils: SigilType[], signs: SignType[], precision = 60): string {
  if (sigils.length === 0) return 'O círculo vibra sem encontrar uma essência elemental.';

  const primarySign = signs[0] ?? 'column';
  const sigilText = sigils.map(s => SIGIL_FLAVOR[s].essence.toLowerCase()).join(', ');
  const signText = SIGN_FLAVOR[primarySign];
  const craftText =
    precision >= 90 ? 'A geometria perfeita abre uma descoberta rara'
    : precision >= 75 ? 'A boa simetria estabiliza uma variação nova'
    : precision >= 55 ? 'O traço ainda oscila, mas revela uma combinação útil'
    : 'A forma frágil produz uma descoberta instável';

  const extraSigns = signs.slice(1).map(s => SIGN_FLAVOR[s].reward).join(', ');
  return `${craftText}: ${signText.action} com ${sigilText}${extraSigns ? ` e adiciona ${extraSigns}` : ''}.`;
}

export function buildProceduralSpell(
  sigils: SigilType[],
  signs: SignType[],
  discovered = false,
  precision = 65
): Spell {
  const { nameBonus } = calculateCombinationBonus(sigils, signs, precision);
  const stats = estimateSpellStats(sigils, signs, precision);
  const id = getSpellPatternId(sigils, signs);
  const namePt = generateSpellName(sigils, signs, nameBonus);

  return {
    id,
    name: namePt,
    namePt,
    description: describeProceduralEffect(sigils, signs, precision),
    effects: [],
    glyphPattern: { sigils: [...sigils], signs: [...signs] },
    damage: stats.damage,
    healing: stats.healing,
    shield: stats.shield,
    discovered,
    useCount: discovered ? 1 : 0,
    tier: getProceduralTier(sigils, signs, precision),
  };
}

export function formatDiscoveryMessage(spell: Spell, precision: number): string {
  const tierName: Record<1 | 2 | 3, string> = {
    1: 'comum',
    2: 'rara',
    3: 'arcana',
  };
  return `Nova descoberta ${tierName[spell.tier]}: ${spell.namePt} (${precision}%).`;
}

// ============================================
// SPELL CREATION
// ============================================

export interface CastResult {
  spellName: string;
  description: string;
  damage: number;
  healing: number;
  shield: number;
  effects: SpellEffect[];
  accuracy: number;
  precision: number;
  isSuccess: boolean;
  feedback: string;
  elementalMultiplier: number;
  inkCost: number;
  inkRemaining?: number;
  inkOverloadChance?: number;
  inkFailure?: string;
  inkCostBreakdown?: InkCostBreakdown;
  primarySigil?: SigilType;
}

export function castSpell(
  sigils: SigilType[],
  signs: SignType[],
  precision: number,
  target: Entity,
  caster?: Entity
): CastResult {
  if (sigils.length === 0) {
    return {
      spellName: 'Falha Mágica',
      description: 'Nenhum sigilo elementar foi reconhecido.',
      damage: 0, healing: 0, shield: 0,
      effects: [], accuracy: 0, precision,
      isSuccess: false,
      feedback: 'O glifo precisa de um sigilo elementar no centro.',
      elementalMultiplier: 0,
      inkCost: 0,
    };
  }

  const inkCostBreakdown = calculateLegacySpellInkCost({ sigils, signs, precision });
  const inkSimulation = caster
    ? simulateInkSpend(
        {
          ink: caster.ink,
          maxInk: caster.maxInk,
          inkRegenPerTurn: caster.inkRegenPerTurn,
          inkPurity: caster.inkPurity,
          inkViscosity: caster.inkViscosity,
          inkVolatility: caster.inkVolatility,
          inkAffinity: caster.inkAffinity,
          activeInfusionIds: caster.activeInfusionIds,
        },
        inkCostBreakdown,
      )
    : undefined;

  if (inkSimulation && !inkSimulation.ok) {
    return {
      spellName: 'Tinta Insuficiente',
      description: `A magia exigia ${inkSimulation.cost} de tinta, mas o reservatorio tinha ${caster?.ink ?? 0}.`,
      damage: 0,
      healing: 0,
      shield: 0,
      effects: [],
      accuracy: 0,
      precision,
      isSuccess: false,
      feedback: 'A tinta rarefez antes de completar o circuito.',
      elementalMultiplier: 0,
      inkCost: 0,
      inkRemaining: caster?.ink,
      inkOverloadChance: inkSimulation.overloadChance,
      inkFailure: inkSimulation.message,
      inkCostBreakdown,
    };
  }

  const { damageBonus, nameBonus, description: comboDesc } = calculateCombinationBonus(sigils, signs, precision);
  const spellName = generateSpellName(sigils, signs, nameBonus);

  let totalDamage = 0;
  let totalHealing = 0;
  let totalShield = 0;
  const effects: SpellEffect[] = [];
  let totalAccuracy = 0;

  const activeSign = signs.length > 0 ? signs[0] : 'column' as SignType;
  const activeSignEffect = SIGN_EFFECTS[activeSign];

  for (const sigil of sigils) {
    const baseDmg = BASE_DAMAGE[sigil];
    const baseHeal = BASE_HEALING[sigil];
    const baseShield = BASE_SHIELD[sigil];

    // Calculate elemental multiplier vs enemy weakness
    const elemMult = getWeaknessMultiplier(sigil, target.weakness);

    const precFactor = Math.max(0.2, precision / 100);
    const dmg = Math.round(baseDmg * activeSignEffect.damageMod * elemMult * precFactor);
    const heal = Math.round(baseHeal * activeSignEffect.healMod * precFactor);
    const shield = Math.round(baseShield * activeSignEffect.shieldMod * precFactor);
    const acc = Math.min(100, 65 + activeSignEffect.accuracyMod + (precision - 50) * 0.4);

    totalDamage += dmg;
    totalHealing += heal;
    totalShield += shield;
    totalAccuracy += acc;

    effects.push({
      element: sigil,
      form: activeSign,
      power: baseDmg,
      potency: dmg,
      accuracy: acc,
      area: activeSignEffect.area,
      special: activeSignEffect.special,
    });

    // Additional signs beyond the first add bonuses
    for (let i = 1; i < signs.length; i++) {
      const extraSign = SIGN_EFFECTS[signs[i]];
      totalDamage += Math.round(baseDmg * extraSign.damageMod * 0.4 * precFactor);
      totalHealing += Math.round(baseHeal * extraSign.healMod * 0.4 * precFactor);
      totalShield += Math.round(baseShield * extraSign.shieldMod * 0.4 * precFactor);
    }
  }

  // Apply combination bonus
  totalDamage = Math.round(totalDamage * damageBonus);
  totalHealing = Math.round(totalHealing * damageBonus);
  totalShield = Math.round(totalShield * damageBonus);
  const avgAccuracy = effects.length > 0 ? Math.round(totalAccuracy / effects.length) : 0;

  let feedback = '';
  if (precision >= 90) feedback = '✦ Perfeito! A magia flui com maestria absoluta.';
  else if (precision >= 75) feedback = '◆ Boa formação! O glifo está estável.';
  else if (precision >= 55) feedback = '◇ Aceitável, mas o glifo oscila.';
  else feedback = '△ Magia fraca devido à imprecisão do desenho.';
  if (comboDesc) feedback += ` ${comboDesc}`;
  feedback += ` ${describeProceduralEffect(sigils, signs, precision)}`;

  const description =
    `Sigilo${sigils.length > 1 ? 's' : ''}: ${sigils.map(s => SIGILS[s].namePt).join(', ')}` +
    (signs.length > 0 ? ` | Chave${signs.length > 1 ? 's' : ''}: ${signs.map(s => SIGNS[s].namePt).join(', ')}` : '') +
    ` | Precisão: ${precision}%`;

  return {
    spellName,
    description,
    damage: totalDamage,
    healing: totalHealing,
    shield: totalShield,
    effects,
    accuracy: avgAccuracy,
    precision,
    isSuccess: precision >= 35,
    feedback,
    elementalMultiplier: effects.length > 0 ? getWeaknessMultiplier(effects[0].element, target.weakness) : 1,
    inkCost: inkCostBreakdown.total,
    inkRemaining: inkSimulation?.remainingInk,
    inkOverloadChance: inkSimulation?.overloadChance,
    inkCostBreakdown,
    primarySigil: sigils[0],
  };
}

// ============================================
// PREDEFINED SPELL LIBRARY
// ============================================

const CURATED_SPELLS: Spell[] = [
  // Tier 1 - Basic
  { id: 'fire-column',     name: 'Flame Column',     namePt: 'Coluna de Fogo',       description: 'Um feixe de chamas que consome tudo.', effects: [], glyphPattern: { sigils: ['fire'],    signs: ['column'] },       damage: 28, healing: 0,  shield: 0,  discovered: false, useCount: 0, tier: 1 },
  { id: 'water-levitation',name: 'Water Orb',        namePt: 'Orbe de Água',         description: 'Esfera de água flutuante que cura e protege.', effects: [], glyphPattern: { sigils: ['water'],   signs: ['levitation'] },   damage: 10, healing: 14, shield: 9,  discovered: false, useCount: 0, tier: 1 },
  { id: 'earth-enlarge',   name: 'Growing Wall',     namePt: 'Montanha Crescente',   description: 'Barreira de terra crescente.', effects: [], glyphPattern: { sigils: ['earth'],   signs: ['enlarge'] },      damage: 23, healing: 0,  shield: 26, discovered: false, useCount: 0, tier: 1 },
  { id: 'wind-bolt',       name: 'Wind Blade',       namePt: 'Lâmina de Vento',      description: 'Projétil cortante de ar comprimido.', effects: [], glyphPattern: { sigils: ['wind'],    signs: ['bolt'] },         damage: 19, healing: 0,  shield: 0,  discovered: false, useCount: 0, tier: 1 },
  { id: 'light-heal',      name: 'Holy Mend',        namePt: 'Benção Sagrada',       description: 'Luz sagrada que restaura a vida.', effects: [], glyphPattern: { sigils: ['light'],   signs: ['heal_sign'] },    damage: 5,  healing: 30, shield: 10, discovered: false, useCount: 0, tier: 1 },
  { id: 'ice-bolt',        name: 'Ice Shard',        namePt: 'Seta de Cristal',      description: 'Cristal de gelo afiado lançado a alta velocidade.', effects: [], glyphPattern: { sigils: ['ice'],     signs: ['bolt'] },         damage: 22, healing: 0,  shield: 0,  discovered: false, useCount: 0, tier: 1 },
  { id: 'thunder-column',  name: 'Lightning',        namePt: 'Relâmpago',            description: 'Raio elétrico de imenso poder.', effects: [], glyphPattern: { sigils: ['thunder'],  signs: ['column'] },       damage: 34, healing: 0,  shield: 0,  discovered: false, useCount: 0, tier: 1 },
  { id: 'nature-heal',     name: 'Forest Mend',      namePt: 'Cura da Floresta',     description: 'A natureza restaura o corpo e a mente.', effects: [], glyphPattern: { sigils: ['nature'],  signs: ['heal_sign'] },    damage: 0,  healing: 25, shield: 8,  discovered: false, useCount: 0, tier: 1 },
  // Tier 2 - Advanced
  { id: 'light-convergence',name: 'Focused Light',   namePt: 'Luz Concentrada',      description: 'Raio de luz focalizado que perfura tudo.', effects: [], glyphPattern: { sigils: ['light'],   signs: ['convergence'] },  damage: 38, healing: 0,  shield: 0,  discovered: false, useCount: 0, tier: 2 },
  { id: 'earth-shield',    name: 'Stone Wall',       namePt: 'Muralha de Pedra',     description: 'Barreira de pedra impenetrável.', effects: [], glyphPattern: { sigils: ['earth'],   signs: ['shield_sign'] },  damage: 0,  healing: 0,  shield: 40, discovered: false, useCount: 0, tier: 2 },
  { id: 'ice-chain',       name: 'Ice Chains',       namePt: 'Correntes de Gelo',    description: 'Correntes geladas que imobilizam completamente.', effects: [], glyphPattern: { sigils: ['ice'],     signs: ['chain'] },        damage: 18, healing: 0,  shield: 14, discovered: false, useCount: 0, tier: 2 },
  { id: 'shadow-weave',    name: 'Shadow Tentacles', namePt: 'Tentáculos Sombrios',  description: 'Tentáculos das trevas que restringem o alvo.', effects: [], glyphPattern: { sigils: ['shadow'],  signs: ['weave'] },        damage: 22, healing: 0,  shield: 0,  discovered: false, useCount: 0, tier: 2 },
  { id: 'fire-explosion',  name: 'Grand Explosion',  namePt: 'Grande Explosão',      description: 'Explosão massiva de fogo em área.', effects: [], glyphPattern: { sigils: ['fire'],    signs: ['explosion'] },    damage: 36, healing: 0,  shield: 0,  discovered: false, useCount: 0, tier: 2 },
  { id: 'void-convergence',name: 'Singularity',      namePt: 'Singularidade',        description: 'Um ponto de colapso que anula toda defesa.', effects: [], glyphPattern: { sigils: ['void'],    signs: ['convergence'] },  damage: 44, healing: 0,  shield: 0,  discovered: false, useCount: 0, tier: 2 },
  // Tier 3 - Legendary
  { id: 'light-bird',      name: 'Bird of Light',    namePt: 'Pássaro de Luz',       description: 'Ave luminosa que persegue o inimigo implacavelmente.', effects: [], glyphPattern: { sigils: ['light'],   signs: ['bird'] },         damage: 30, healing: 0,  shield: 0,  discovered: false, useCount: 0, tier: 3 },
  { id: 'fire-wind',       name: 'Firestorm',        namePt: 'Tempestade de Fogo',   description: 'Turbilhão de chamas alimentado pelo vento.', effects: [], glyphPattern: { sigils: ['fire','wind'],signs: ['column'] },       damage: 48, healing: 0,  shield: 0,  discovered: false, useCount: 0, tier: 3 },
  { id: 'water-light-rain',name: 'Starlight Rain',   namePt: 'Chuva Estelar',        description: 'Gotas de luz que curam e protegem toda a área.', effects: [], glyphPattern: { sigils: ['water','light'], signs: ['rain'] },       damage: 18, healing: 28, shield: 12, discovered: false, useCount: 0, tier: 3 },
  { id: 'void-explosion',  name: 'Implosion',        namePt: 'Implosão',             description: 'O vazio colapsa tudo em um ponto e destrói.', effects: [], glyphPattern: { sigils: ['void'],    signs: ['explosion'] },    damage: 55, healing: 0,  shield: 0,  discovered: false, useCount: 0, tier: 3 },
  { id: 'thunder-water',   name: 'Maelstrom',        namePt: 'Maelstrom Elétrico',   description: 'Tempestade de raios e água de poder absoluto.', effects: [], glyphPattern: { sigils: ['thunder','water'], signs: ['dispersion'] }, damage: 46, healing: 0,  shield: 0,  discovered: false, useCount: 0, tier: 3 },
];

const ALL_SIGIL_TYPES = Object.keys(SIGILS) as SigilType[];
const ALL_SIGN_TYPES = Object.keys(SIGNS) as SignType[];

const ELEMENTAL_PAIR_SEEDS: SigilType[][] = [
  ['fire', 'wind'],
  ['water', 'wind'],
  ['fire', 'earth'],
  ['water', 'earth'],
  ['fire', 'light'],
  ['water', 'light'],
  ['ice', 'wind'],
  ['thunder', 'water'],
  ['shadow', 'void'],
  ['nature', 'water'],
  ['light', 'thunder'],
  ['fire', 'shadow'],
  ['ice', 'nature'],
  ['void', 'light'],
  ['earth', 'thunder'],
  ['nature', 'shadow'],
];

const PAIR_SIGN_SEEDS: SignType[] = [
  'column',
  'dispersion',
  'convergence',
  'rain',
  'spiral',
  'explosion',
  'shield_sign',
  'chain',
];

const GENERATED_SPELLS: Spell[] = [
  ...ALL_SIGIL_TYPES.flatMap(sigil =>
    ALL_SIGN_TYPES.map(sign => buildProceduralSpell([sigil], [sign], false, 62))
  ),
  ...ELEMENTAL_PAIR_SEEDS.flatMap(sigils =>
    PAIR_SIGN_SEEDS.map(sign => buildProceduralSpell(sigils, [sign], false, 74))
  ),
];

function mergeSpellCatalog(spells: Spell[]): Spell[] {
  const byPattern = new Map<string, Spell>();
  for (const spell of spells) {
    const key = getSpellPatternId(spell.glyphPattern.sigils, spell.glyphPattern.signs);
    if (!byPattern.has(key)) byPattern.set(key, spell);
  }
  return [...byPattern.values()];
}

export const PREDEFINED_SPELLS: Spell[] = mergeSpellCatalog([
  ...CURATED_SPELLS,
  ...GENERATED_SPELLS,
]);

// ============================================
// ENEMY GENERATION
// ============================================

export interface EnemyTemplate {
  name: string;
  hp: number;
  element: SigilType | null;
  weakness: SigilType | null;
  resistance: SigilType | null;
  description?: string;
}

export const ENEMIES: EnemyTemplate[] = [
  { name: 'Slime de Sombra',    hp: 55,  element: null,      weakness: 'light',   resistance: 'earth',   description: 'Uma criatura sombria e viscosa.' },
  { name: 'Lobo de Fogo',       hp: 80,  element: 'fire',    weakness: 'water',   resistance: 'wind',    description: 'Lobo envolto em chamas ardentes.' },
  { name: 'Golem de Pedra',     hp: 120, element: 'earth',   weakness: 'wind',    resistance: 'fire',    description: 'Guardião colossal de rocha antiga.' },
  { name: 'Espectro d\'Água',   hp: 70,  element: 'water',   weakness: 'thunder', resistance: 'fire',    description: 'Espírito aquático maligno.' },
  { name: 'Harpia Elétrica',    hp: 65,  element: 'thunder', weakness: 'earth',   resistance: 'wind',    description: 'Ave que controla raios com suas asas.' },
  { name: 'Sombra Corrompida',  hp: 90,  element: 'shadow',  weakness: 'light',   resistance: 'shadow',  description: 'Um ser das trevas em forma pura.' },
  { name: 'Basilisco de Gelo',  hp: 100, element: 'ice',     weakness: 'fire',    resistance: 'ice',     description: 'Serpente cujo olhar petrifica e congela.' },
  { name: 'Ent da Floresta',    hp: 110, element: 'nature',  weakness: 'fire',    resistance: 'water',   description: 'Árvore milenar tomada pela fúria.' },
  { name: 'Dragão do Vazio',    hp: 140, element: 'void',    weakness: 'light',   resistance: 'shadow',  description: 'Dragão que emerge do nada absoluto.' },
  { name: 'Fênix Sombria',      hp: 115, element: 'fire',    weakness: 'ice',     resistance: 'light',   description: 'Fênix corrompida pelas sombras.' },
  { name: 'Guardião Trovejante',hp: 130, element: 'thunder', weakness: 'earth',   resistance: 'water',   description: 'Coloso que comanda a tempestade.' },
  { name: 'Behemoth Gelado',    hp: 160, element: 'ice',     weakness: 'fire',    resistance: 'nature',  description: 'Colosso de gelo de poder imensurável.' },
];

export function generateEnemy(round: number): Entity {
  const template = ENEMIES[Math.min(round - 1, ENEMIES.length - 1)];
  const scaleFactor = 1 + (round - 1) * 0.15;

  return {
    id: `enemy-${round}`,
    name: template.name,
    hp: Math.round(template.hp * scaleFactor),
    maxHp: Math.round(template.hp * scaleFactor),
    shield: 0,
    ink: DEFAULT_ENEMY_INK.ink,
    maxInk: DEFAULT_ENEMY_INK.maxInk + Math.floor((round - 1) / 3),
    inkRegenPerTurn: DEFAULT_ENEMY_INK.inkRegenPerTurn,
    inkPurity: DEFAULT_ENEMY_INK.inkPurity,
    inkViscosity: DEFAULT_ENEMY_INK.inkViscosity,
    inkVolatility: DEFAULT_ENEMY_INK.inkVolatility,
    inkAffinity: template.element,
    activeInfusionIds: DEFAULT_ENEMY_INK.activeInfusionIds,
    element: template.element,
    weakness: template.weakness,
    resistance: template.resistance,
    status: [],
    isPlayer: false,
  };
}

// ============================================
// ENEMY AI
// ============================================

export function getEnemyAction(enemy: Entity): { damage: number; effect?: string; inkCost: number; inkFailure?: string } {
  const baseDamage = 8 + Math.floor(Math.random() * 14);
  const elementalBonus = enemy.element ? 6 : 0;
  const desperateCost = 4;
  const specialCost = 3;
  const basicCost = 2;

  if (enemy.hp < enemy.maxHp * 0.3 && Math.random() < 0.45) {
    if (enemy.ink < desperateCost) {
      return {
        damage: 0,
        effect: `${enemy.name} tenta forcar tinta demais e perde o traco.`,
        inkCost: 0,
        inkFailure: 'insufficient_ink',
      };
    }

    return {
      damage: Math.round(baseDamage * 1.6) + elementalBonus,
      effect: `${enemy.name} usa um ataque desesperado!`,
      inkCost: desperateCost,
    };
  }

  if (Math.random() < 0.2) {
    if (enemy.ink < specialCost) {
      return {
        damage: 0,
        effect: `${enemy.name} prepara um ataque especial, mas a tinta nao fecha o fluxo.`,
        inkCost: 0,
        inkFailure: 'insufficient_ink',
      };
    }

    return {
      damage: Math.round(baseDamage * 1.3) + elementalBonus,
      inkCost: specialCost,
      effect: `${enemy.name} lança um ataque especial!`,
    };
  }

  if (enemy.ink < basicCost) {
    return {
      damage: 0,
      effect: `${enemy.name} hesita enquanto a tinta se recompoe.`,
      inkCost: 0,
      inkFailure: 'insufficient_ink',
    };
  }

  return {
    damage: baseDamage + elementalBonus,
    effect: undefined,
    inkCost: basicCost,
  };
}
