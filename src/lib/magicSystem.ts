import type { SigilType, SignType, Point, Bounds, GlyphComponent, StrokeAnalysis, PrecisionBreakdown, DrawingStroke } from '@/types/magic';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// SIGIL DEFINITIONS - The 10 elements
// ============================================

export interface SigilDef {
  type: SigilType;
  name: string;
  namePt: string;
  description: string;
  howToDraw: string;      // Drawing instructions
  color: string;
  glowColor: string;
  icon: string;
  // Recognition parameters (tuned to be very distinct from each other)
  minPoints: number;
  idealCorners: number;     // Sharp direction changes detected
  idealAspectRatio: number; // max/min dimension ratio (1 = square)
  idealConvexity: number;   // 1 = fully convex, 0 = very concave
  minArea: number;
  isClosed: boolean;        // Should the shape be closed?
  isCurved: boolean;        // Should it be mainly curved (low corners)?
  // Unique signature features
  cornerWeight: number;     // How much corners matter (0-1)
  curvatureWeight: number;  // How much curvature matters (0-1)
}

export const SIGILS: Record<SigilType, SigilDef> = {
  fire: {
    type: 'fire',
    name: 'Flame',
    namePt: 'Ignis',
    description: 'Chama ardente que consome tudo',
    howToDraw: 'Triângulo com lados levemente côncavos (forma de chama)',
    color: '#e85d3e',
    glowColor: '#ff7744',
    icon: '🔥',
    minPoints: 15,
    idealCorners: 3,
    idealAspectRatio: 1.3,
    idealConvexity: 0.45,   // Slightly concave (flame is not perfectly convex)
    minArea: 300,
    isClosed: false,
    isCurved: false,
    cornerWeight: 0.9,
    curvatureWeight: 0.3,
  },
  water: {
    type: 'water',
    name: 'Water',
    namePt: 'Unda',
    description: 'Água fluida que flui e se adapta',
    howToDraw: 'Onda em S ou curva ampla e fluida (sem cantos)',
    color: '#3b8dd4',
    glowColor: '#55bbff',
    icon: '💧',
    minPoints: 15,
    idealCorners: 0,        // NO corners - purely curved
    idealAspectRatio: 2.2,  // Very wide wave shape
    idealConvexity: 0.25,   // Very concave / wavy
    minArea: 200,
    isClosed: false,
    isCurved: true,
    cornerWeight: 0.2,
    curvatureWeight: 0.95,
  },
  earth: {
    type: 'earth',
    name: 'Earth',
    namePt: 'Terran',
    description: 'Terra sólida, robusta e resistente',
    howToDraw: 'Quadrado ou retângulo com cantos marcados',
    color: '#8b6f47',
    glowColor: '#aa8855',
    icon: '🟫',
    minPoints: 12,
    idealCorners: 4,        // Square = 4 corners
    idealAspectRatio: 1.15, // Nearly square
    idealConvexity: 0.88,   // Very convex (solid square)
    minArea: 350,
    isClosed: true,
    isCurved: false,
    cornerWeight: 0.95,
    curvatureWeight: 0.1,
  },
  wind: {
    type: 'wind',
    name: 'Wind',
    namePt: 'Aer',
    description: 'Vento livre, cortante e veloz',
    howToDraw: 'Arco rápido e aberto, como uma boomerang ou crescente',
    color: '#7ec8a0',
    glowColor: '#88eebb',
    icon: '💨',
    minPoints: 12,
    idealCorners: 1,        // One main curve/bend
    idealAspectRatio: 2.0,  // Wide swoosh
    idealConvexity: 0.30,   // Very concave crescent
    minArea: 150,
    isClosed: false,
    isCurved: true,
    cornerWeight: 0.3,
    curvatureWeight: 0.8,
  },
  light: {
    type: 'light',
    name: 'Light',
    namePt: 'Lux',
    description: 'Luz radiante, pura e sagrada',
    howToDraw: 'Estrela de 5 pontas ou pentagrama',
    color: '#f0d060',
    glowColor: '#ffee88',
    icon: '✨',
    minPoints: 16,
    idealCorners: 5,        // Star = 5 points = 5 corners
    idealAspectRatio: 1.05, // Nearly circular bounding box
    idealConvexity: 0.45,   // Star shape is moderately concave
    minArea: 300,
    isClosed: false,
    isCurved: false,
    cornerWeight: 0.95,
    curvatureWeight: 0.2,
  },
  ice: {
    type: 'ice',
    name: 'Ice',
    namePt: 'Glacies',
    description: 'Gelo cristalino que paralisa e congela',
    howToDraw: 'Hexágono regular ou floco de neve (6 lados)',
    color: '#88d4ee',
    glowColor: '#aaeeff',
    icon: '❄️',
    minPoints: 14,
    idealCorners: 6,        // Hexagon = 6 corners
    idealAspectRatio: 1.1,  // Roughly square bounding box
    idealConvexity: 0.85,   // Hexagon is convex
    minArea: 280,
    isClosed: true,
    isCurved: false,
    cornerWeight: 0.95,
    curvatureWeight: 0.1,
  },
  shadow: {
    type: 'shadow',
    name: 'Shadow',
    namePt: 'Umbra',
    description: 'Sombra escura que drena e enfraquece',
    howToDraw: 'Meia-lua ou crescente (curva ampla e fechada)',
    color: '#9b6bcc',
    glowColor: '#bb88ff',
    icon: '🌙',
    minPoints: 14,
    idealCorners: 0,        // Crescent = no sharp corners
    idealAspectRatio: 1.6,  // Somewhat wide crescent
    idealConvexity: 0.50,   // Half-moon shape
    minArea: 200,
    isClosed: true,
    isCurved: true,
    cornerWeight: 0.15,
    curvatureWeight: 0.9,
  },
  thunder: {
    type: 'thunder',
    name: 'Thunder',
    namePt: 'Fulmen',
    description: 'Raio elétrico veloz e devastador',
    howToDraw: 'Zigzag em formato de raio (como a letra Z ou W)',
    color: '#e0d020',
    glowColor: '#ffff44',
    icon: '⚡',
    minPoints: 10,
    idealCorners: 4,        // Zigzag = many sharp corners
    idealAspectRatio: 2.5,  // Tall/elongated shape
    idealConvexity: 0.20,   // Very concave (zigzag)
    minArea: 200,
    isClosed: false,
    isCurved: false,
    cornerWeight: 0.95,
    curvatureWeight: 0.1,
  },
  nature: {
    type: 'nature',
    name: 'Nature',
    namePt: 'Natura',
    description: 'Natureza viva que cura e enreda',
    howToDraw: 'Folha oval com nervura, ou espiral orgânica',
    color: '#44cc66',
    glowColor: '#66ee88',
    icon: '🌿',
    minPoints: 14,
    idealCorners: 2,        // Leaf tip + base = 2 corners
    idealAspectRatio: 1.7,  // Elongated leaf
    idealConvexity: 0.65,   // Mostly convex leaf
    minArea: 250,
    isClosed: true,
    isCurved: true,
    cornerWeight: 0.4,
    curvatureWeight: 0.7,
  },
  void: {
    type: 'void',
    name: 'Void',
    namePt: 'Vacuus',
    description: 'O vazio absoluto que anula e absorve toda magia',
    howToDraw: 'Círculo pequeno e fechado (mais compacto que o anel externo)',
    color: '#8866aa',
    glowColor: '#aa88cc',
    icon: '🌑',
    minPoints: 12,
    idealCorners: 0,        // Perfect circle = no corners
    idealAspectRatio: 1.05, // Nearly perfect square bounding box
    idealConvexity: 0.92,   // Very convex (circle)
    minArea: 150,
    isClosed: true,
    isCurved: true,
    cornerWeight: 0.05,
    curvatureWeight: 0.95,
  },
};

// ============================================
// SIGN DEFINITIONS - Modifiers / Keystones
// ============================================

export interface SignDef {
  type: SignType;
  name: string;
  namePt: string;
  description: string;
  effect: string;
  howToDraw: string;        // Drawing instructions
  // Recognition parameters
  minPoints: number;
  isLinear: boolean;        // Mostly straight lines?
  isAngular: boolean;       // Has sharp corners?
  isCurved: boolean;        // Mostly curved?
  isClosed: boolean;        // Forms a closed shape?
  idealLength: number;      // Ideal total stroke length
  branchCount: number;      // Number of branches/arms
  // Unique features for better discrimination
  idealCorners: number;     // Expected corner count
  idealAspect: number;      // Expected aspect ratio
  straightnessMin: number;  // Minimum straightness for angular signs
  curvatureMin: number;     // Minimum curvature variance for curved signs
}

export const SIGNS: Record<SignType, SignDef> = {
  column: {
    type: 'column',
    name: 'Column',
    namePt: 'Coluna',
    description: 'Dispara como um feixe vertical de energia',
    effect: 'Dispara em linha reta com grande força',
    howToDraw: 'Linha reta vertical (de cima para baixo)',
    minPoints: 8,
    isLinear: true,
    isAngular: false,
    isCurved: false,
    isClosed: false,
    idealLength: 80,
    branchCount: 1,
    idealCorners: 0,
    idealAspect: 3.5,       // Very tall, narrow
    straightnessMin: 0.85,  // Must be very straight
    curvatureMin: 0,
  },
  dispersion: {
    type: 'dispersion',
    name: 'Dispersion',
    namePt: 'Dispersão',
    description: 'Espalha a magia em todas as direções',
    effect: 'Atinge múltiplos alvos ao redor',
    howToDraw: 'Estrela com muitos raios (desenhe linhas saindo de um ponto central)',
    minPoints: 15,
    isLinear: false,
    isAngular: true,
    isCurved: false,
    isClosed: false,
    idealLength: 140,
    branchCount: 5,
    idealCorners: 5,
    idealAspect: 1.1,       // Star is roughly square bounding box
    straightnessMin: 0,
    curvatureMin: 0,
  },
  levitation: {
    type: 'levitation',
    name: 'Levitation',
    namePt: 'Levitação',
    description: 'Eleva e sustenta no ar',
    effect: 'Faz flutuar acima do glifo',
    howToDraw: 'Arco aberto voltado para cima (como um U invertido)',
    minPoints: 10,
    isLinear: false,
    isAngular: false,
    isCurved: true,
    isClosed: false,
    idealLength: 70,
    branchCount: 1,
    idealCorners: 0,
    idealAspect: 1.5,
    straightnessMin: 0,
    curvatureMin: 0.04,
  },
  direction: {
    type: 'direction',
    name: 'Direction',
    namePt: 'Direção',
    description: 'Direciona a magia com precisão',
    effect: 'Mira e direciona o feitiço',
    howToDraw: 'Seta (linha reta com ponta triangular na frente)',
    minPoints: 8,
    isLinear: true,
    isAngular: true,
    isCurved: false,
    isClosed: false,
    idealLength: 70,
    branchCount: 1,
    idealCorners: 1,
    idealAspect: 2.0,
    straightnessMin: 0.6,
    curvatureMin: 0,
  },
  convergence: {
    type: 'convergence',
    name: 'Convergence',
    namePt: 'Convergência',
    description: 'Focaliza toda a magia em um único ponto',
    effect: 'Concentra o poder em alvo único',
    howToDraw: 'Letra Y ou funil (três linhas convergindo para um ponto)',
    minPoints: 10,
    isLinear: true,
    isAngular: true,
    isCurved: false,
    isClosed: false,
    idealLength: 100,
    branchCount: 3,
    idealCorners: 2,
    idealAspect: 1.3,
    straightnessMin: 0.5,
    curvatureMin: 0,
  },
  bolt: {
    type: 'bolt',
    name: 'Bolt',
    namePt: 'Raio',
    description: 'Lança um projétil veloz e penetrante',
    effect: 'Ataque rápido e penetrante',
    howToDraw: 'Zigzag horizontal (como um raio deitado: Z)',
    minPoints: 8,
    isLinear: true,
    isAngular: true,
    isCurved: false,
    isClosed: false,
    idealLength: 90,
    branchCount: 1,
    idealCorners: 2,
    idealAspect: 2.5,       // Wide zigzag
    straightnessMin: 0.3,
    curvatureMin: 0,
  },
  rain: {
    type: 'rain',
    name: 'Rain',
    namePt: 'Chuva',
    description: 'Cai como chuva sobre a área toda',
    effect: 'Dano em área ao longo do tempo',
    howToDraw: 'Série de arcos curtos para baixo (como gotas caindo)',
    minPoints: 12,
    isLinear: false,
    isAngular: false,
    isCurved: true,
    isClosed: false,
    idealLength: 120,
    branchCount: 3,
    idealCorners: 0,
    idealAspect: 1.8,
    straightnessMin: 0,
    curvatureMin: 0.04,
  },
  enlarge: {
    type: 'enlarge',
    name: 'Enlarge',
    namePt: 'Ampliação',
    description: 'Amplia e potencializa o efeito',
    effect: 'Potencializa o poder do sigilo',
    howToDraw: 'Retângulo fechado com cantos marcados',
    minPoints: 12,
    isLinear: true,
    isAngular: true,
    isCurved: false,
    isClosed: true,
    idealLength: 100,
    branchCount: 4,
    idealCorners: 4,
    idealAspect: 1.5,
    straightnessMin: 0.5,
    curvatureMin: 0,
  },
  bird: {
    type: 'bird',
    name: 'Bird',
    namePt: 'Ave',
    description: 'Cria uma projeção em forma de pássaro perseguidor',
    effect: 'Projétil que persegue o alvo',
    howToDraw: 'Duas asas curvas espelhadas (M ou V aberto)',
    minPoints: 15,
    isLinear: false,
    isAngular: false,
    isCurved: true,
    isClosed: false,
    idealLength: 130,
    branchCount: 2,
    idealCorners: 1,
    idealAspect: 2.2,
    straightnessMin: 0,
    curvatureMin: 0.03,
  },
  weave: {
    type: 'weave',
    name: 'Weave',
    namePt: 'Teia',
    description: 'Transforma em fitas que restringem o alvo',
    effect: 'Restringe e imobiliza o alvo',
    howToDraw: 'Curva em S (sinuosa, como uma serpente)',
    minPoints: 12,
    isLinear: false,
    isAngular: false,
    isCurved: true,
    isClosed: false,
    idealLength: 100,
    branchCount: 1,
    idealCorners: 0,
    idealAspect: 1.8,
    straightnessMin: 0,
    curvatureMin: 0.06,
  },
  pull: {
    type: 'pull',
    name: 'Pull',
    namePt: 'Atração',
    description: 'Puxa e agrupa inimigos em direção ao glifo',
    effect: 'Puxa e agrupa inimigos',
    howToDraw: 'Gancho (linha com curva fechada em J)',
    minPoints: 10,
    isLinear: false,
    isAngular: false,
    isCurved: true,
    isClosed: false,
    idealLength: 80,
    branchCount: 1,
    idealCorners: 0,
    idealAspect: 1.2,
    straightnessMin: 0,
    curvatureMin: 0.05,
  },
  crush: {
    type: 'crush',
    name: 'Crush',
    namePt: 'Esmagamento',
    description: 'Dano massivo e devastador em alvo único',
    effect: 'Dano massivo em alvo único',
    howToDraw: 'Cruz em X (dois traços diagonais cruzados)',
    minPoints: 8,
    isLinear: true,
    isAngular: true,
    isCurved: false,
    isClosed: false,
    idealLength: 80,
    branchCount: 2,
    idealCorners: 1,
    idealAspect: 1.1,       // X is roughly square
    straightnessMin: 0.5,
    curvatureMin: 0,
  },
  collection: {
    type: 'collection',
    name: 'Collection',
    namePt: 'Coleção',
    description: 'Absorve e redireciona a energia ao redor',
    effect: 'Absorve e redireciona energia',
    howToDraw: 'Espiral compacta que vai para dentro',
    minPoints: 12,
    isLinear: false,
    isAngular: false,
    isCurved: true,
    isClosed: false,
    idealLength: 90,
    branchCount: 1,
    idealCorners: 0,
    idealAspect: 1.1,
    straightnessMin: 0,
    curvatureMin: 0.04,
  },
  billowing: {
    type: 'billowing',
    name: 'Billowing',
    namePt: 'Acolchoamento',
    description: 'Cria nuvens macias protetoras',
    effect: 'Cria barreiras de proteção suave',
    howToDraw: 'Curva ondulada com múltiplas protuberâncias (como nuvem)',
    minPoints: 14,
    isLinear: false,
    isAngular: false,
    isCurved: true,
    isClosed: false,
    idealLength: 110,
    branchCount: 3,
    idealCorners: 0,
    idealAspect: 2.5,
    straightnessMin: 0,
    curvatureMin: 0.05,
  },
  float: {
    type: 'float',
    name: 'Float',
    namePt: 'Flutuação',
    description: 'Levitação defensiva e mobilidade',
    effect: 'Levitação e mobilidade',
    howToDraw: 'Oval ou elipse fechada (mais larga que alta)',
    minPoints: 12,
    isLinear: false,
    isAngular: false,
    isCurved: true,
    isClosed: true,
    idealLength: 90,
    branchCount: 0,
    idealCorners: 0,
    idealAspect: 1.6,       // Oval/ellipse = wider than tall
    straightnessMin: 0,
    curvatureMin: 0.02,
  },
  shield_sign: {
    type: 'shield_sign',
    name: 'Shield',
    namePt: 'Escudo',
    description: 'Barreira protetora que absorve dano',
    effect: 'Cria uma barreira mágica sólida',
    howToDraw: 'Semicírculo ou formato D (linha reta + arco)',
    minPoints: 10,
    isLinear: false,
    isAngular: false,
    isCurved: true,
    isClosed: true,
    idealLength: 100,
    branchCount: 1,
    idealCorners: 0,
    idealAspect: 1.0,
    straightnessMin: 0,
    curvatureMin: 0.03,
  },
  heal_sign: {
    type: 'heal_sign',
    name: 'Heal',
    namePt: 'Cura',
    description: 'Restaura pontos de vida e purifica',
    effect: 'Restaura vida e remove efeitos negativos',
    howToDraw: 'Cruz ou sinal de + (dois traços perpendiculares)',
    minPoints: 10,
    isLinear: true,
    isAngular: true,
    isCurved: false,
    isClosed: false,
    idealLength: 80,
    branchCount: 2,
    idealCorners: 1,
    idealAspect: 1.0,       // Cross is square
    straightnessMin: 0.6,
    curvatureMin: 0,
  },
  reflect: {
    type: 'reflect',
    name: 'Reflect',
    namePt: 'Reflexo',
    description: 'Reflete ataques de volta ao inimigo',
    effect: 'Devolve parte do dano recebido',
    howToDraw: 'Dois traços diagonais paralelos (barra dupla //)',
    minPoints: 10,
    isLinear: true,
    isAngular: false,
    isCurved: false,
    isClosed: false,
    idealLength: 85,
    branchCount: 2,
    idealCorners: 0,
    idealAspect: 1.8,
    straightnessMin: 0.7,
    curvatureMin: 0,
  },
  chain: {
    type: 'chain',
    name: 'Chain',
    namePt: 'Corrente',
    description: 'Encadeia e prende o alvo no lugar',
    effect: 'Imobiliza completamente o alvo',
    howToDraw: 'Figura 8 deitada (∞ infinito) ou dois círculos conectados',
    minPoints: 14,
    isLinear: false,
    isAngular: false,
    isCurved: true,
    isClosed: true,
    idealLength: 120,
    branchCount: 2,
    idealCorners: 0,
    idealAspect: 2.0,
    straightnessMin: 0,
    curvatureMin: 0.03,
  },
  explosion: {
    type: 'explosion',
    name: 'Explosion',
    namePt: 'Explosão',
    description: 'Libera toda a energia em uma explosão massiva',
    effect: 'Dano em área maciço e destruidor',
    howToDraw: 'Estrela angular de muitos raios (como explosão de HQ)',
    minPoints: 16,
    isLinear: true,
    isAngular: true,
    isCurved: false,
    isClosed: false,
    idealLength: 160,
    branchCount: 8,
    idealCorners: 8,
    idealAspect: 1.0,
    straightnessMin: 0,
    curvatureMin: 0,
  },
  spiral: {
    type: 'spiral',
    name: 'Spiral',
    namePt: 'Espiral',
    description: 'Magia que gira e amplifica continuamente',
    effect: 'Aumenta progressivamente o poder do feitiço',
    howToDraw: 'Espiral que começa grande e vai se fechando (caracol)',
    minPoints: 18,
    isLinear: false,
    isAngular: false,
    isCurved: true,
    isClosed: false,
    idealLength: 180,
    branchCount: 0,
    idealCorners: 0,
    idealAspect: 1.1,
    straightnessMin: 0,
    curvatureMin: 0.02,
  },
  anchor: {
    type: 'anchor',
    name: 'Anchor',
    namePt: 'Âncora',
    description: 'Fixa e estabiliza a magia no lugar',
    effect: 'Cria uma fonte de magia estável e duradoura',
    howToDraw: 'T com curva semicircular na base (âncora de navio)',
    minPoints: 12,
    isLinear: true,
    isAngular: true,
    isCurved: true,
    isClosed: false,
    idealLength: 100,
    branchCount: 3,
    idealCorners: 2,
    idealAspect: 1.1,
    straightnessMin: 0.3,
    curvatureMin: 0.02,
  },
};

export const ACTIVE_SIGIL_TYPES = [
  'fire',
  'water',
  'earth',
  'wind',
  'light',
  'ice',
  'shadow',
  'thunder',
  'nature',
  'void',
] as const satisfies readonly SigilType[];

export const ACTIVE_SIGN_TYPES = [
  'column',
  'direction',
  'convergence',
  'dispersion',
  'shield_sign',
  'heal_sign',
  'chain',
  'spiral',
] as const satisfies readonly SignType[];

const ACTIVE_SIGIL_SET = new Set<SigilType>(ACTIVE_SIGIL_TYPES);
const ACTIVE_SIGN_SET = new Set<SignType>(ACTIVE_SIGN_TYPES);

const isActiveSigilType = (type: TemplateType | undefined): type is SigilType =>
  Boolean(type && ACTIVE_SIGIL_SET.has(type as SigilType));

const isActiveSignType = (type: TemplateType | undefined): type is SignType =>
  Boolean(type && ACTIVE_SIGN_SET.has(type as SignType));

// ============================================
// GEOMETRY UTILITIES
// ============================================

export function getBounds(points: Point[]): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function getCenter(bounds: Bounds): Point {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

export function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function convexHullArea(points: Point[]): number {
  return polygonArea(convexHull(points));
}

/**
 * Count sharp direction changes (corners) in a stroke.
 * threshold controls sensitivity: lower = more corners detected
 */
export function countCorners(points: Point[], threshold = -0.4, closed = isClosedShape(points)): number {
  if (points.length < 10) return 0;
  let corners = 0;
  const step = Math.max(1, Math.floor(points.length / 60));
  const start = closed ? 0 : step;
  const end = closed ? points.length : points.length - step;

  for (let i = start; i < end; i += step) {
    const prev = closed ? points[(i - step + points.length) % points.length] : points[i - step];
    const curr = points[i];
    const next = closed ? points[(i + step) % points.length] : points[i + step];
    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    if (mag > 2 && dot / mag < threshold) corners++;
  }
  return corners;
}

export function calculateCurvatureVariance(points: Point[]): number {
  if (points.length < 10) return 0;
  const angles: number[] = [];
  const step = Math.max(1, Math.floor(points.length / 30));
  for (let i = step; i < points.length - step; i += step) {
    const v1 = { x: points[i].x - points[i - step].x, y: points[i].y - points[i - step].y };
    const v2 = { x: points[i + step].x - points[i].x, y: points[i + step].y - points[i].y };
    const cross = v1.x * v2.y - v1.y * v2.x;
    const dot = v1.x * v2.x + v1.y * v2.y;
    angles.push(Math.atan2(cross, dot));
  }
  if (angles.length < 2) return 0;
  const mean = angles.reduce((a, b) => a + b) / angles.length;
  return angles.reduce((s, a) => s + (a - mean) ** 2, 0) / angles.length;
}

export function calculateStraightness(points: Point[]): number {
  if (points.length < 3) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const len = Math.hypot(dx, dy);
  if (len < 5) return 0.5;
  let maxDist = 0;
  for (const p of points) {
    const t = Math.max(0, Math.min(1, ((p.x - first.x) * dx + (p.y - first.y) * dy) / (len * len)));
    const projX = first.x + t * dx;
    const projY = first.y + t * dy;
    maxDist = Math.max(maxDist, Math.hypot(p.x - projX, p.y - projY));
  }
  return Math.max(0, 1 - maxDist / 30);
}

export function totalLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

export function isClosedShape(points: Point[]): boolean {
  if (points.length < 10) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const bounds = getBounds(points);
  const diagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const tolerance = Math.max(18, Math.min(42, diagonal * 0.14));
  return Math.hypot(last.x - first.x, last.y - first.y) <= tolerance;
}

export function getClosureDistance(points: Point[]): number {
  if (points.length < 2) return Infinity;
  const first = points[0];
  const last = points[points.length - 1];
  return Math.hypot(last.x - first.x, last.y - first.y);
}

export function getClosureScore(points: Point[]): number {
  if (points.length < 2) return 0;
  const bounds = getBounds(points);
  const diagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const tolerance = Math.max(14, Math.min(52, diagonal * 0.13));
  return Math.max(0, 100 - (getClosureDistance(points) / tolerance) * 100);
}

export interface RingQuality {
  readonly closureDistance: number;
  readonly closureScore: number;
  readonly angularCoverage: number;
  readonly angularCoverageScore: number;
  readonly circularityScore: number;
  readonly centralityScore: number;
  readonly sizeScore: number;
  readonly ovalPenalty: number;
  readonly precision: number;
  readonly isPlausibleRing: boolean;
}

export function analyzeRingQuality(
  points: Point[],
  canvasCenter: Point,
  rawClosureDistance = getClosureDistance(points),
): RingQuality {
  if (points.length < 8) {
    return {
      closureDistance: rawClosureDistance,
      closureScore: 0,
      angularCoverage: 0,
      angularCoverageScore: 0,
      circularityScore: 0,
      centralityScore: 0,
      sizeScore: 0,
      ovalPenalty: 100,
      precision: 0,
      isPlausibleRing: false,
    };
  }

  const bounds = getBounds(points);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const diameter = Math.max(width, height);
  const radius = Math.max(1, diameter / 2);
  const center = getCenter(bounds);
  const closureTolerance = Math.max(14, Math.min(58, radius * 0.22));
  const closureScore = Math.max(0, 100 - (rawClosureDistance / closureTolerance) * 100);
  const circularityScore = calculateCircularity(points) * 100;
  const distToCanvasCenter = Math.hypot(center.x - canvasCenter.x, center.y - canvasCenter.y);
  const centralityScore = Math.max(0, 100 - (distToCanvasCenter / Math.max(80, radius * 0.62)) * 100);
  const sizeScore = Math.max(0, Math.min(100, ((diameter - RING_MIN_DIAMETER) / 90) * 100));
  const aspect = Math.min(width, height) > 0 ? Math.max(width, height) / Math.min(width, height) : 99;
  const ovalPenalty = Math.max(0, Math.min(100, (aspect - 1.18) * 135));
  const angles = points.map((point) => Math.atan2(point.y - center.y, point.x - center.x));
  const sortedAngles = [...angles].sort((a, b) => a - b);
  let maxGap = Math.PI * 2;

  if (sortedAngles.length > 1) {
    maxGap = 0;
    for (let index = 0; index < sortedAngles.length; index += 1) {
      const next = (index + 1) % sortedAngles.length;
      let gap = sortedAngles[next] - sortedAngles[index];
      if (gap < 0) gap += Math.PI * 2;
      if (gap > maxGap) maxGap = gap;
    }
  }

  const angularCoverage = Math.max(0, Math.min(1, 1 - maxGap / (Math.PI * 2)));
  const angularCoverageScore = angularCoverage * 100;
  const precision = Math.max(
    0,
    Math.min(
      100,
      circularityScore * 0.34 +
        closureScore * 0.28 +
        angularCoverageScore * 0.2 +
        centralityScore * 0.12 +
        sizeScore * 0.06 -
        ovalPenalty * 0.2,
    ),
  );

  return {
    closureDistance: rawClosureDistance,
    closureScore,
    angularCoverage,
    angularCoverageScore,
    circularityScore,
    centralityScore,
    sizeScore,
    ovalPenalty,
    precision,
    isPlausibleRing:
      diameter >= RING_MIN_DIAMETER &&
      closureScore > 45 &&
      angularCoverage > 0.76 &&
      circularityScore > 35 &&
      centralityScore > 18 &&
      ovalPenalty < 58,
  };
}

export function closeStrokeIfNear(points: Point[], maxDistance = 40): Point[] {
  if (points.length < 2) return points;
  if (getClosureDistance(points) > maxDistance) return points;

  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(last.x - first.x, last.y - first.y) < 0.5) return points;
  return [...points, { ...first }];
}

export function calculateSymmetry(points: Point[], center: Point): number {
  if (points.length < 10) return 0;
  let symmetricPairs = 0;
  const checked = new Set<number>();

  for (let i = 0; i < points.length; i++) {
    if (checked.has(i)) continue;
    const mirrored = {
      x: center.x * 2 - points[i].x,
      y: points[i].y,
    };
    for (let j = i + 1; j < points.length; j++) {
      if (!checked.has(j) && Math.hypot(points[j].x - mirrored.x, points[j].y - mirrored.y) < 15) {
        symmetricPairs++;
        checked.add(i);
        checked.add(j);
        break;
      }
    }
  }
  return Math.min(100, (symmetricPairs / (points.length / 2)) * 100);
}

/**
 * Calculate how "circular" a closed shape is.
 * Returns 0-1 where 1 = perfect circle.
 */
export function calculateCircularity(points: Point[]): number {
  const bounds = getBounds(points);
  const center = getCenter(bounds);
  const dists = points.map(p => Math.hypot(p.x - center.x, p.y - center.y));
  const avg = dists.reduce((a, b) => a + b) / dists.length;
  if (avg < 1) return 0;
  const variance = dists.reduce((s, d) => s + (d - avg) ** 2, 0) / dists.length;
  const cv = Math.sqrt(variance) / avg;
  return Math.max(0, 1 - cv / 0.5);
}

// ============================================
// STROKE CLASSIFICATION
// ============================================

// Minimum diameter (in canvas pixels) for a stroke to be treated as a ring.
// Anything smaller is considered a sigil/sign drawn near center.
const RING_MIN_DIAMETER = 190;

export function analyzeStroke(points: Point[], canvasCenter: Point): StrokeAnalysis {
  if (points.length < 5) {
    return {
      isSigil: false, isSign: false, isRing: false,
      precision: 0, symmetry: 0,
      center: points[0] || { x: 0, y: 0 },
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      points,
    };
  }

  const bounds = getBounds(points);
  const center = getCenter(bounds);
  const area = polygonArea(points);
  const convexArea = convexHullArea(points);
  const convexity = convexArea > 0 ? area / convexArea : 0;
  const closed = isClosedShape(points);
  const corners = countCorners(points, -0.4, closed);
  const curvatureVar = calculateCurvatureVariance(points);
  const straightness = calculateStraightness(points);
  const strokeLen = totalLength(points);
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const aspect = Math.min(w, h) > 0 ? Math.max(w, h) / Math.min(w, h) : 1;
  const distFromCenter = Math.hypot(center.x - canvasCenter.x, center.y - canvasCenter.y);
  const circularity = calculateCircularity(points);

  // ── Ring detection (MUST come first and use lenient thresholds) ──────────
  // A ring is a large-ish circle that encloses the drawing area.
  // We check this before sigil/sign so that a good circle is NEVER mis-classified.
  const diameter = Math.max(w, h);
  const ringResult = analyzeRing(points, canvasCenter, bounds);
  // Accept ring if it passes the geometric test OR if it's clearly large + circular
  if (ringResult.isRing && ringResult.precision > 45) {
    return {
      isSigil: false,
      isSign: false,
      isRing: true,
      precision: ringResult.precision,
      symmetry: ringResult.symmetry,
      center,
      bounds,
      points,
    };
  }
  // Conservative fallback for intentionally drawn rings with minor sampling noise.
  if (diameter >= RING_MIN_DIAMETER * 1.15 && distFromCenter < 95 && closed && circularity > 0.42 && corners <= 2) {
    return {
      isSigil: false,
      isSign: false,
      isRing: true,
      precision: Math.max(20, ringResult.precision),
      symmetry: ringResult.symmetry,
      center,
      bounds,
      points,
    };
  }

  const features = { corners, aspect, convexity, curvatureVar, straightness, area, closed, strokeLen, circularity };

  // Try classifying as a sigil (only for SMALL-TO-MEDIUM strokes near center)
  // Large strokes (diameter >= RING_MIN_DIAMETER) should have been caught as rings above.
  if (distFromCenter < 90 && area > 150 && diameter < RING_MIN_DIAMETER * 1.8) {
    const sigilResult = classifySigil(points, features);
    if (sigilResult.sigilType && sigilResult.precision > 28) {
      return {
        isSigil: true,
        sigilType: sigilResult.sigilType,
        isSign: false,
        isRing: false,
        precision: sigilResult.precision,
        symmetry: calculateSymmetry(points, center),
        center,
        bounds,
        points,
      };
    }
  }

  // Try classifying as a sign (modifier around/near center)
  if (distFromCenter < 140 && strokeLen > 25) {
    const signResult = classifySign(points, features);
    if (signResult.signType && signResult.precision > 28) {
      return {
        isSigil: false,
        isSign: true,
        signType: signResult.signType,
        isRing: false,
        precision: signResult.precision,
        symmetry: calculateSymmetry(points, center),
        center,
        bounds,
        points,
      };
    }
  }

  return {
    isSigil: false,
    isSign: false,
    isRing: false,
    precision: 0,
    symmetry: 0,
    center,
    bounds,
    points,
  };
}

interface ShapeFeatures {
  corners: number;
  aspect: number;
  convexity: number;
  curvatureVar: number;
  straightness: number;
  area: number;
  closed: boolean;
  strokeLen: number;
  circularity: number;
}

// ============================================
// SIGIL CLASSIFICATION - Improved discriminative scoring
// ============================================

function classifySigil(
  points: Point[],
  features: ShapeFeatures,
): { sigilType?: SigilType; precision: number } {
  const { corners, aspect, convexity, curvatureVar, straightness, area, closed, circularity } = features;

  type SigilScore = { type: SigilType; score: number };
  const scores: SigilScore[] = [];

  // --- VOID ---
  // Small closed circle ONLY — must be distinctly smaller than a ring.
  // Hard gate: if the stroke diameter is >= RING_MIN_DIAMETER, it is a ring candidate, not void.
  {
    let s = 0;
    // Void must be a small compact circle (fits in roughly half the canvas region)
    // If it's big, we heavily penalise so it never wins over other sigilos
    const isTooLarge = area > 8000;
    if (!isTooLarge) {
      if (circularity > 0.6) s += 35;
      else if (circularity > 0.4) s += 15;
      if (corners === 0) s += 20;
      else if (corners <= 1) s += 10;
      if (aspect < 1.3) s += 15;
      if (closed) s += 20;
      if (curvatureVar < 0.05) s += 10;
      // Extra penalty for large area (ring-sized)
      if (area > 5000) s = Math.round(s * 0.3);
      else if (area > 2000) s = Math.round(s * 0.6);
    }
    scores.push({ type: 'void', score: s });
  }

  // --- EARTH ---
  // Square: 4 corners, aspect ~1, very convex, closed
  {
    let s = 0;
    const cornerDiff = Math.abs(corners - 4);
    if (cornerDiff === 0) s += 35;
    else if (cornerDiff === 1) s += 20;
    else if (cornerDiff === 2) s += 8;
    if (convexity > 0.80) s += 25;
    else if (convexity > 0.65) s += 12;
    if (aspect < 1.4) s += 15;
    if (closed) s += 15;
    if (straightness < 0.5) s += 5; // has right angles
    if (curvatureVar < 0.04) s += 5; // straight sides
    scores.push({ type: 'earth', score: s });
  }

  // --- ICE ---
  // Hexagon: 6 corners, aspect ~1, convex, closed
  {
    let s = 0;
    const cornerDiff = Math.abs(corners - 6);
    if (cornerDiff === 0) s += 35;
    else if (cornerDiff === 1) s += 22;
    else if (cornerDiff === 2) s += 10;
    if (convexity > 0.75) s += 20;
    if (aspect < 1.3) s += 15;
    if (closed) s += 15;
    if (curvatureVar < 0.04) s += 10;
    scores.push({ type: 'ice', score: s });
  }

  // --- FIRE ---
  // Triangle: 2-4 corners, slightly wide, low-medium convexity (concave flame)
  {
    let s = 0;
    const cornerDiff = Math.abs(corners - 3);
    if (cornerDiff === 0) s += 30;
    else if (cornerDiff === 1) s += 18;
    else if (cornerDiff === 2) s += 8;
    if (convexity >= 0.35 && convexity <= 0.65) s += 20;
    if (aspect >= 1.0 && aspect <= 1.8) s += 15;
    if (!closed) s += 10;
    if (curvatureVar < 0.06) s += 10; // mostly straight sides
    scores.push({ type: 'fire', score: s });
  }

  // --- THUNDER ---
  // Zigzag: many corners (4+), very angular, low convexity, NOT closed, tall aspect
  {
    let s = 0;
    if (corners >= 3 && corners <= 7) s += 30;
    else if (corners >= 2) s += 15;
    if (convexity < 0.35) s += 20;
    else if (convexity < 0.55) s += 8;
    if (aspect >= 1.8) s += 20;
    if (!closed) s += 10;
    if (straightness > 0.3) s += 10; // segments are straight
    if (curvatureVar < 0.05) s += 5; // angular, not wavy
    scores.push({ type: 'thunder', score: s });
  }

  // --- LIGHT ---
  // Star: 5 corners, aspect ~1, moderate convexity
  {
    let s = 0;
    const cornerDiff = Math.abs(corners - 5);
    if (cornerDiff === 0) s += 35;
    else if (cornerDiff === 1) s += 20;
    else if (cornerDiff === 2) s += 8;
    if (convexity >= 0.35 && convexity <= 0.60) s += 20;
    if (aspect < 1.3) s += 15;
    if (corners >= 4) s += 10;
    scores.push({ type: 'light', score: s });
  }

  // --- WATER ---
  // S-curve / wave: 0-1 corners, very curved, wide, NOT closed
  {
    let s = 0;
    if (corners === 0) s += 30;
    else if (corners <= 1) s += 18;
    if (curvatureVar > 0.06) s += 30;
    else if (curvatureVar > 0.03) s += 15;
    if (aspect >= 1.6) s += 20;
    if (!closed) s += 10;
    if (convexity < 0.40) s += 10;
    scores.push({ type: 'water', score: s });
  }

  // --- WIND ---
  // Swoosh / crescent: 0-1 corner, curved, wide, NOT closed, moderately concave
  {
    let s = 0;
    if (corners === 0) s += 20;
    else if (corners === 1) s += 30;
    else if (corners === 2) s += 15;
    if (curvatureVar > 0.04) s += 20;
    if (aspect >= 1.5) s += 20;
    if (!closed) s += 15;
    if (convexity < 0.45) s += 10;
    scores.push({ type: 'wind', score: s });
  }

  // --- SHADOW ---
  // Crescent / closed blob: 0 corners, curved, closed, moderately concave
  {
    let s = 0;
    if (corners === 0) s += 25;
    else if (corners <= 1) s += 15;
    if (closed) s += 25;
    if (curvatureVar > 0.03) s += 15;
    if (convexity >= 0.35 && convexity <= 0.70) s += 20;
    if (aspect >= 1.2 && aspect <= 2.2) s += 10;
    scores.push({ type: 'shadow', score: s });
  }

  // --- NATURE ---
  // Leaf: 1-2 corners, curved, closed, elongated, moderately convex
  {
    let s = 0;
    if (corners >= 1 && corners <= 3) s += 25;
    if (curvatureVar > 0.03) s += 15;
    if (closed) s += 20;
    if (convexity >= 0.50 && convexity <= 0.80) s += 20;
    if (aspect >= 1.3 && aspect <= 2.5) s += 15;
    scores.push({ type: 'nature', score: s });
  }

  // Area bonus for all
  for (const entry of scores) {
    const def = SIGILS[entry.type];
    if (area > def.minArea) entry.score += 8;
    if (points.length >= def.minPoints) entry.score += 8;
  }

  // Find best match
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const secondBest = scores[1];

  // Require meaningful separation to avoid false positives
  const separation = best.score - (secondBest?.score ?? 0);
  if (separation < 5) {
    // Too ambiguous - reduce precision
    return { sigilType: best.type, precision: Math.min(55, best.score * 0.7) };
  }

  return {
    sigilType: best.type,
    precision: Math.min(100, best.score + Math.min(20, separation * 0.5)),
  };
}

// ============================================
// SIGN CLASSIFICATION - Improved discriminative scoring
// ============================================

function classifySign(
  points: Point[],
  features: ShapeFeatures,
): { signType?: SignType; precision: number } {
  const { corners, aspect, curvatureVar, straightness, closed, strokeLen, circularity } = features;

  type SignScore = { type: SignType; score: number };
  const scores: SignScore[] = [];

  // --- COLUMN ---
  // Very straight vertical line, tall aspect, 0 corners
  {
    let s = 0;
    if (straightness > 0.85) s += 40;
    else if (straightness > 0.70) s += 25;
    if (aspect > 3.0) s += 30;
    else if (aspect > 2.0) s += 15;
    if (corners === 0) s += 20;
    if (!closed) s += 10;
    scores.push({ type: 'column', score: s });
  }

  // --- HEAL SIGN ---
  // Cross (+): two perpendicular straight lines, aspect ~1, 1 corner
  {
    let s = 0;
    if (corners === 1) s += 30;
    else if (corners === 2) s += 15;
    if (aspect < 1.4) s += 25;
    if (straightness > 0.5) s += 20;
    if (!closed) s += 10;
    if (curvatureVar < 0.04) s += 15;
    scores.push({ type: 'heal_sign', score: s });
  }

  // --- CRUSH ---
  // X cross: diagonal, aspect ~1, 1 corner, two straight lines
  {
    let s = 0;
    if (corners === 1) s += 25;
    else if (corners === 2) s += 15;
    if (aspect < 1.4) s += 20;
    if (straightness > 0.5) s += 15;
    if (!closed) s += 10;
    if (curvatureVar < 0.04) s += 10;
    // Differentiate from heal_sign by noting crush needs to be diagonal
    scores.push({ type: 'crush', score: s });
  }

  // --- REFLECT ---
  // Two parallel diagonal lines: 0 corners, straight, moderate aspect
  {
    let s = 0;
    if (corners === 0) s += 20;
    if (straightness > 0.65) s += 30;
    if (aspect >= 1.3 && aspect <= 2.5) s += 20;
    if (!closed) s += 10;
    if (curvatureVar < 0.03) s += 20;
    scores.push({ type: 'reflect', score: s });
  }

  // --- DIRECTION ---
  // Arrow: 1 corner, mostly straight, moderate aspect
  {
    let s = 0;
    if (corners === 1) s += 25;
    else if (corners === 2) s += 15;
    if (straightness > 0.55) s += 25;
    if (aspect >= 1.5 && aspect <= 3.0) s += 20;
    if (!closed) s += 10;
    scores.push({ type: 'direction', score: s });
  }

  // --- BOLT ---
  // Zigzag horizontal: 2-3 corners, wide aspect, angular
  {
    let s = 0;
    if (corners >= 2 && corners <= 4) s += 30;
    if (aspect >= 2.0) s += 25;
    if (!closed) s += 10;
    if (curvatureVar < 0.04) s += 10; // angular, not smooth
    if (straightness > 0.2) s += 10;
    scores.push({ type: 'bolt', score: s });
  }

  // --- ENLARGE ---
  // Closed rectangle: 4 corners, closed, moderate aspect
  {
    let s = 0;
    if (corners >= 3 && corners <= 5) s += 25;
    if (closed) s += 30;
    if (aspect >= 1.2 && aspect <= 2.2) s += 20;
    if (curvatureVar < 0.04) s += 15;
    scores.push({ type: 'enlarge', score: s });
  }

  // --- CONVERGENCE ---
  // Y/funnel: 2-3 corners, moderate aspect, open
  {
    let s = 0;
    if (corners >= 2 && corners <= 3) s += 30;
    if (!closed) s += 15;
    if (aspect >= 1.0 && aspect <= 2.0) s += 15;
    if (straightness > 0.4) s += 15;
    scores.push({ type: 'convergence', score: s });
  }

  // --- DISPERSION ---
  // Star burst with many points: 5+ corners, aspect ~1
  {
    let s = 0;
    if (corners >= 5) s += 35;
    else if (corners >= 4) s += 20;
    if (aspect < 1.5) s += 20;
    if (!closed) s += 10;
    if (strokeLen > 100) s += 15;
    scores.push({ type: 'dispersion', score: s });
  }

  // --- EXPLOSION ---
  // Many-pointed star: 7+ corners, aspect ~1, many branches
  {
    let s = 0;
    if (corners >= 7) s += 35;
    else if (corners >= 5) s += 20;
    if (aspect < 1.3) s += 20;
    if (strokeLen > 130) s += 20;
    if (!closed) s += 10;
    scores.push({ type: 'explosion', score: s });
  }

  // --- LEVITATION ---
  // Upward arc U-inverted: 0 corners, curved, moderate aspect, open
  {
    let s = 0;
    if (corners === 0) s += 25;
    else if (corners === 1) s += 15;
    if (curvatureVar > 0.035) s += 25;
    if (!closed) s += 15;
    if (aspect >= 1.0 && aspect <= 2.5) s += 15;
    if (straightness < 0.5) s += 10;
    scores.push({ type: 'levitation', score: s });
  }

  // --- RAIN ---
  // Wavy horizontal: 0-1 corners, curved, wide aspect, open
  {
    let s = 0;
    if (corners <= 1) s += 20;
    if (curvatureVar > 0.04) s += 25;
    if (aspect >= 1.5) s += 20;
    if (!closed) s += 10;
    if (strokeLen > 90) s += 10;
    scores.push({ type: 'rain', score: s });
  }

  // --- BIRD ---
  // Two wings M/V: 1-2 corners, curved, wide, open
  {
    let s = 0;
    if (corners >= 1 && corners <= 2) s += 25;
    if (curvatureVar > 0.025) s += 20;
    if (aspect >= 1.8) s += 25;
    if (!closed) s += 10;
    if (strokeLen > 100) s += 10;
    scores.push({ type: 'bird', score: s });
  }

  // --- WEAVE ---
  // S-curve: 0 corners, very curved, moderate aspect, open
  {
    let s = 0;
    if (corners === 0) s += 25;
    if (curvatureVar > 0.055) s += 30;
    if (!closed) s += 10;
    if (aspect >= 1.3 && aspect <= 2.5) s += 15;
    scores.push({ type: 'weave', score: s });
  }

  // --- BILLOWING ---
  // Bumpy cloud: 0 corners, curved, very wide aspect
  {
    let s = 0;
    if (corners === 0) s += 20;
    if (curvatureVar > 0.04) s += 20;
    if (aspect >= 2.0) s += 30;
    if (!closed) s += 10;
    if (strokeLen > 100) s += 10;
    scores.push({ type: 'billowing', score: s });
  }

  // --- FLOAT ---
  // Closed oval: 0 corners, closed, slightly wide
  {
    let s = 0;
    if (closed) s += 35;
    if (corners === 0) s += 20;
    if (curvatureVar > 0.02) s += 15;
    if (circularity > 0.5) s += 20;
    if (aspect >= 1.3 && aspect <= 2.2) s += 10;
    scores.push({ type: 'float', score: s });
  }

  // --- SHIELD SIGN ---
  // D-shape / semicircle: closed, 0-1 corners, curved, aspect ~1
  {
    let s = 0;
    if (closed) s += 25;
    if (corners <= 1) s += 25;
    if (curvatureVar > 0.02) s += 20;
    if (aspect < 1.4) s += 20;
    if (circularity > 0.4) s += 10;
    scores.push({ type: 'shield_sign', score: s });
  }

  // --- CHAIN ---
  // Figure-8: closed, 0 corners, curved, wide aspect
  {
    let s = 0;
    if (closed) s += 20;
    if (corners === 0) s += 20;
    if (curvatureVar > 0.025) s += 20;
    if (aspect >= 1.6) s += 25;
    if (circularity > 0.3) s += 10;
    scores.push({ type: 'chain', score: s });
  }

  // --- COLLECTION ---
  // Inward spiral: 0 corners, curved, aspect ~1, long stroke
  {
    let s = 0;
    if (corners === 0) s += 20;
    if (curvatureVar > 0.03) s += 25;
    if (aspect < 1.5) s += 15;
    if (strokeLen > 80) s += 20;
    if (!closed) s += 10;
    scores.push({ type: 'collection', score: s });
  }

  // --- SPIRAL ---
  // Large spiral: 0 corners, very curved, long, aspect ~1
  {
    let s = 0;
    if (corners === 0) s += 20;
    if (curvatureVar > 0.02) s += 20;
    if (strokeLen > 140) s += 30;
    if (aspect < 1.4) s += 15;
    if (!closed) s += 10;
    scores.push({ type: 'spiral', score: s });
  }

  // --- ANCHOR ---
  // T + curve: 2+ corners, mixed straight and curved
  {
    let s = 0;
    if (corners >= 2 && corners <= 4) s += 25;
    if (curvatureVar > 0.02) s += 20;
    if (aspect >= 0.8 && aspect <= 1.6) s += 20;
    if (!closed) s += 10;
    if (strokeLen > 70) s += 10;
    scores.push({ type: 'anchor', score: s });
  }

  // --- PULL ---
  // Hook / J: 0-1 corners, curved, narrow
  {
    let s = 0;
    if (corners === 0) s += 20;
    else if (corners === 1) s += 15;
    if (curvatureVar > 0.04) s += 20;
    if (aspect < 1.5) s += 20;
    if (!closed) s += 15;
    if (strokeLen < 100) s += 10;
    scores.push({ type: 'pull', score: s });
  }

  // Filter by min points
  const validScores = scores.filter(entry => {
    const def = SIGNS[entry.type];
    return points.length >= def.minPoints;
  });

  if (validScores.length === 0) return { precision: 0 };

  validScores.sort((a, b) => b.score - a.score);
  const best = validScores[0];
  const secondBest = validScores[1];

  const separation = best.score - (secondBest?.score ?? 0);
  if (separation < 5) {
    return { signType: best.type, precision: Math.min(55, best.score * 0.65) };
  }

  return {
    signType: best.type,
    precision: Math.min(100, best.score + Math.min(20, separation * 0.5)),
  };
}

// ============================================
// RING ANALYSIS
// ============================================

interface RingResult {
  isRing: boolean;
  precision: number;
  symmetry: number;
}

function analyzeRing(points: Point[], canvasCenter: Point, bounds: Bounds): RingResult {
  // Require at least 20 points (lenient for fast drawings)
  if (points.length < 20) return { isRing: false, precision: 0, symmetry: 0 };

  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const approxCenter = getCenter(bounds);
  const distToCanvasCenter = Math.hypot(approxCenter.x - canvasCenter.x, approxCenter.y - canvasCenter.y);

  // The activation ring should be the large, centered outer stroke.
  if (distToCanvasCenter > 95) return { isRing: false, precision: 0, symmetry: 0 };

  // Must be large enough to plausibly enclose other elements
  const diameter = Math.max(w, h);
  if (diameter < RING_MIN_DIAMETER) return { isRing: false, precision: 0, symmetry: 0 };

  const quality = analyzeRingQuality(points, canvasCenter);
  const improvedSymmetry = Math.max(0, Math.min(100, (quality.circularityScore + quality.centralityScore) / 2));
  return {
    isRing: quality.isPlausibleRing,
    precision: quality.precision,
    symmetry: improvedSymmetry,
  };

  // Check circularity - distances from center should be consistent
  const dists = points.map(p => Math.hypot(p.x - approxCenter.x, p.y - approxCenter.y));
  const avg = dists.reduce((a, b) => a + b) / dists.length;
  const variance = dists.reduce((s, d) => s + (d - avg) ** 2, 0) / dists.length;
  const cv = Math.sqrt(variance) / avg;

  // Circularity score — use a generous tolerance (cv up to 0.5 still gives some score)
  const circularityScore = Math.max(0, 1 - cv / 0.5) * 100;

  // Check angular coverage
  const angles = points.map(p => Math.atan2(p.y - approxCenter.y, p.x - approxCenter.x));
  const sortedAngles = [...angles].sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 0; i < sortedAngles.length; i++) {
    const next = (i + 1) % sortedAngles.length;
    let gap = sortedAngles[next] - sortedAngles[i];
    if (gap < 0) gap += Math.PI * 2;
    if (gap > maxGap) maxGap = gap;
  }
  const angularCoverage = 1 - (maxGap / (Math.PI * 2));

  // Closure check
  const first = points[0];
  const last = points[points.length - 1];
  const closureDist = Math.hypot(last.x - first.x, last.y - first.y);
  const closureScore = getClosureScore(points);
  const isClosed = closureScore >= 60;

  // Ring quality
  let precision = circularityScore * 0.52;
  precision += angularCoverage * 26;
  precision += closureScore * 0.22;
  if (!isClosed) precision -= Math.min(40, closureDist * 0.32);

  const symmetry = Math.max(0, 100 - cv * 200);

  // isRing: even a somewhat imperfect circle qualifies if it's big and centered
  return {
    isRing: circularityScore > 42 && angularCoverage > 0.78 && closureScore > 55,
    precision: Math.max(0, Math.min(100, precision)),
    symmetry,
  };
}

// ============================================
// GLYPH ASSEMBLY & PRECISION
// ============================================

export function calculateGlyphPrecision(
  ring: GlyphComponent | null,
  sigils: GlyphComponent[],
  signs: GlyphComponent[],
  canvasCenter: Point
): PrecisionBreakdown {
  const ringQuality = ring ? analyzeRingQuality(ring.points, canvasCenter, ring.rawClosureDistance) : null;
  const circlePerfection = ringQuality?.precision ?? ring?.precision ?? 0;

  let ringClosure = 0;
  if (ring && ring.points.length > 10) {
    ringClosure = ringQuality?.closureScore ?? getClosureScore(ring.points);
  }

  const sigilPrecision = sigils.length > 0
    ? sigils.reduce((s, g) => s + g.precision, 0) / sigils.length
    : 0;

  const signPrecision = signs.length > 0
    ? signs.reduce((s, g) => s + g.precision, 0) / signs.length
    : 0;

  let symmetry = 0;
  if (ring) {
    const allElements = [...sigils, ...signs];
    const componentSymmetry = allElements.length > 0
      ? allElements.reduce((sum, el) => sum + calculateSymmetry(el.points, el.center), 0) / allElements.length
      : 0;
    let layoutSymmetry = 0;
    if (allElements.length >= 2) {
      const elementAngles = allElements.map(el =>
        Math.atan2(el.center.y - canvasCenter.y, el.center.x - canvasCenter.x)
      );
      let anglePairs = 0;
      for (let i = 0; i < elementAngles.length; i++) {
        const opposite = (elementAngles[i] + Math.PI) % (Math.PI * 2);
        for (let j = i + 1; j < elementAngles.length; j++) {
          const diff = Math.abs(elementAngles[j] - opposite);
          if (diff < 0.5 || Math.abs(diff - Math.PI * 2) < 0.5) {
            anglePairs++;
            break;
          }
        }
      }
      layoutSymmetry = allElements.length > 1
        ? Math.min(100, (anglePairs / Math.floor(allElements.length / 2)) * 100)
        : 50;
    } else {
      layoutSymmetry = 60;
    }
    symmetry = allElements.length > 0
      ? layoutSymmetry * 0.65 + componentSymmetry * 0.35
      : layoutSymmetry;
  }

  let proportions = 0;
  if (ring && sigils.length > 0) {
    const ringRadius = (ring.bounds.maxX - ring.bounds.minX) / 2;
    const sigilSizes = sigils.map(s =>
      Math.max(s.bounds.maxX - s.bounds.minX, s.bounds.maxY - s.bounds.minY)
    );
    const avgSigilSize = sigilSizes.reduce((a, b) => a + b, 0) / sigilSizes.length;
    const idealRatio = 0.28;
    const actualRatio = avgSigilSize / (ringRadius * 2);
    const ratioDiff = Math.abs(actualRatio - idealRatio);
    proportions = Math.max(0, 100 - ratioDiff * 300);
  }

  const overall = (
    circlePerfection * 0.28 +
    ringClosure * 0.22 +
    sigilPrecision * 0.18 +
    signPrecision * 0.16 +
    symmetry * 0.12 +
    proportions * 0.04
  );

  return {
    circlePerfection: Math.round(circlePerfection),
    ringClosure: Math.round(ringClosure),
    sigilPrecision: Math.round(sigilPrecision),
    signPrecision: Math.round(signPrecision),
    symmetry: Math.round(symmetry),
    proportions: Math.round(proportions),
    overall: Math.round(overall),
  };
}

// ============================================
// FULL GLYPH RECOGNITION - batch, free drawing
// ============================================

type TemplateKind = 'sigil' | 'sign';
type TemplateType = SigilType | SignType;

interface RecognitionTemplate {
  kind: TemplateKind;
  type: TemplateType;
  strokes: Point[][];
}

interface RecognizedGroup {
  kind: TemplateKind;
  type: TemplateType;
  strokes: DrawingStroke[];
  points: Point[];
  score: number;
  firstIndex: number;
  lastIndex: number;
  indexes: number[];
}

const TEMPLATE_POINT_COUNT = 56;
const RASTER_SIZE = 36;
const RASTER_PADDING = 4;
const RASTER_STROKE_RADIUS = 1;

const pt = (x: number, y: number): Point => ({ x, y });

function makeLine(a: Point, b: Point, steps = 18): Point[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = steps === 1 ? 0 : i / (steps - 1);
    return pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  });
}

function makePolyline(vertices: Point[], stepsPerSegment = 12): Point[] {
  const points: Point[] = [];
  for (let i = 1; i < vertices.length; i++) {
    const segment = makeLine(vertices[i - 1], vertices[i], stepsPerSegment);
    points.push(...(i === 1 ? segment : segment.slice(1)));
  }
  return points;
}

function makeArc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  start: number,
  end: number,
  steps = 32,
): Point[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const angle = start + (end - start) * t;
    return pt(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
  });
}

function makeCircle(rx = 0.8, ry = rx, steps = 44): Point[] {
  return makeArc(0, 0, rx, ry, 0, Math.PI * 2, steps + 1);
}

function makeStar(points = 5, outer = 0.95, inner = 0.42): Point[] {
  const vertices: Point[] = [];
  for (let i = 0; i <= points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    vertices.push(pt(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  return makePolyline(vertices, 8);
}

function makeSpiral(turns = 2.2, steps = 58, inward = true): Point[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    const radius = inward ? 0.88 * (1 - t) + 0.08 : 0.08 + 0.82 * t;
    const angle = -Math.PI / 2 + t * turns * Math.PI * 2;
    return pt(Math.cos(angle) * radius, Math.sin(angle) * radius);
  });
}

function makeSine(width = 1.8, amplitude = 0.42, cycles = 1.25, steps = 48): Point[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return pt(-width / 2 + width * t, Math.sin((t * cycles - 0.1) * Math.PI * 2) * amplitude);
  });
}

function makeRadialBurst(arms: number, radius = 0.88): Point[][] {
  return Array.from({ length: arms }, (_, i) => {
    const angle = (i / arms) * Math.PI * 2;
    return makeLine(pt(0, 0), pt(Math.cos(angle) * radius, Math.sin(angle) * radius), 8);
  });
}

const RECOGNITION_TEMPLATES: RecognitionTemplate[] = ([
  { kind: 'sigil', type: 'fire', strokes: [makePolyline([pt(0, -0.9), pt(0.72, 0.72), pt(0.05, 0.45), pt(-0.72, 0.72), pt(0, -0.9)], 12)] },
  { kind: 'sigil', type: 'water', strokes: [makeSine(1.9, 0.42, 1.15, 52)] },
  { kind: 'sigil', type: 'earth', strokes: [makePolyline([pt(-0.75, -0.75), pt(0.75, -0.75), pt(0.75, 0.75), pt(-0.75, 0.75), pt(-0.75, -0.75)], 12)] },
  { kind: 'sigil', type: 'wind', strokes: [makeArc(0.05, 0, 0.96, 0.58, Math.PI * 0.92, Math.PI * 1.95, 46)] },
  { kind: 'sigil', type: 'light', strokes: [makeStar(5, 0.95, 0.38)] },
  { kind: 'sigil', type: 'ice', strokes: [makePolyline(Array.from({ length: 7 }, (_, i) => {
    const angle = -Math.PI / 2 + (i / 6) * Math.PI * 2;
    return pt(Math.cos(angle) * 0.85, Math.sin(angle) * 0.85);
  }), 9)] },
  { kind: 'sigil', type: 'shadow', strokes: [[...makeArc(0.18, 0, 0.74, 0.88, Math.PI * 0.28, Math.PI * 1.72, 34), ...makeArc(-0.12, 0, 0.45, 0.64, Math.PI * 1.62, Math.PI * 0.38, 28)]] },
  { kind: 'sigil', type: 'thunder', strokes: [makePolyline([pt(-0.3, -0.95), pt(0.38, -0.18), pt(0.02, -0.1), pt(0.42, 0.9), pt(-0.42, 0.05), pt(-0.08, 0.04)], 9)] },
  { kind: 'sigil', type: 'nature', strokes: [[...makeArc(0, 0, 0.5, 0.88, Math.PI * 1.14, Math.PI * 1.86, 24), ...makeArc(0, 0, 0.5, 0.88, Math.PI * -0.14, Math.PI * 0.86, 24)], makeLine(pt(0, -0.72), pt(0, 0.72), 18)] },
  { kind: 'sigil', type: 'void', strokes: [makeCircle(0.72, 0.72, 44)] },

  { kind: 'sign', type: 'column', strokes: [makeLine(pt(0, -0.9), pt(0, 0.9), 34)] },
  { kind: 'sign', type: 'dispersion', strokes: makeRadialBurst(5, 0.86) },
  { kind: 'sign', type: 'levitation', strokes: [makeArc(0, 0.15, 0.86, 0.58, Math.PI * 1.08, Math.PI * 1.92, 38)] },
  { kind: 'sign', type: 'direction', strokes: [makePolyline([pt(-0.9, 0), pt(0.65, 0), pt(0.32, -0.28), pt(0.65, 0), pt(0.32, 0.28)], 9)] },
  { kind: 'sign', type: 'convergence', strokes: [makeLine(pt(-0.75, -0.75), pt(0, 0.12), 14), makeLine(pt(0.75, -0.75), pt(0, 0.12), 14), makeLine(pt(0, 0.12), pt(0, 0.9), 14)] },
  { kind: 'sign', type: 'bolt', strokes: [makePolyline([pt(-0.9, -0.2), pt(-0.25, -0.15), pt(-0.48, 0.24), pt(0.22, 0.18), pt(0.02, 0.62), pt(0.9, 0.02)], 8)] },
  { kind: 'sign', type: 'rain', strokes: [makeArc(-0.55, -0.1, 0.24, 0.42, Math.PI * 0.08, Math.PI * 0.92, 16), makeArc(0, -0.1, 0.24, 0.42, Math.PI * 0.08, Math.PI * 0.92, 16), makeArc(0.55, -0.1, 0.24, 0.42, Math.PI * 0.08, Math.PI * 0.92, 16)] },
  { kind: 'sign', type: 'enlarge', strokes: [makePolyline([pt(-0.9, -0.58), pt(0.9, -0.58), pt(0.9, 0.58), pt(-0.9, 0.58), pt(-0.9, -0.58)], 10)] },
  { kind: 'sign', type: 'bird', strokes: [makeArc(-0.42, 0.1, 0.55, 0.38, Math.PI * 1.1, Math.PI * 1.92, 24), makeArc(0.42, 0.1, 0.55, 0.38, Math.PI * 1.08, Math.PI * 1.9, 24).map(p => pt(-p.x, p.y))] },
  { kind: 'sign', type: 'weave', strokes: [makeSine(1.4, 0.5, 1.55, 52)] },
  { kind: 'sign', type: 'pull', strokes: [makePolyline([pt(-0.15, -0.92), pt(-0.15, 0.34)], 16), makeArc(0.12, 0.34, 0.38, 0.38, Math.PI, Math.PI * 2.2, 28)] },
  { kind: 'sign', type: 'crush', strokes: [makeLine(pt(-0.75, -0.75), pt(0.75, 0.75), 22), makeLine(pt(0.75, -0.75), pt(-0.75, 0.75), 22)] },
  { kind: 'sign', type: 'collection', strokes: [makeSpiral(2.15, 54, true)] },
  { kind: 'sign', type: 'billowing', strokes: [makeSine(1.9, 0.24, 2.6, 58)] },
  { kind: 'sign', type: 'float', strokes: [makeCircle(0.9, 0.52, 42)] },
  { kind: 'sign', type: 'shield_sign', strokes: [makePolyline([pt(-0.65, -0.75), pt(-0.65, 0.75)], 18), makeArc(-0.65, 0, 0.98, 0.76, -Math.PI / 2, Math.PI / 2, 36)] },
  { kind: 'sign', type: 'heal_sign', strokes: [makeLine(pt(0, -0.85), pt(0, 0.85), 24), makeLine(pt(-0.85, 0), pt(0.85, 0), 24)] },
  { kind: 'sign', type: 'reflect', strokes: [makeLine(pt(-0.5, 0.78), pt(0.12, -0.78), 24), makeLine(pt(0.08, 0.78), pt(0.7, -0.78), 24)] },
  { kind: 'sign', type: 'chain', strokes: [makeCircle(0.48, 0.55, 36).map(p => pt(p.x - 0.42, p.y)), makeCircle(0.48, 0.55, 36).map(p => pt(p.x + 0.42, p.y))] },
  { kind: 'sign', type: 'explosion', strokes: [makeStar(8, 0.96, 0.38)] },
  { kind: 'sign', type: 'spiral', strokes: [makeSpiral(2.9, 64, false)] },
  { kind: 'sign', type: 'anchor', strokes: [makeLine(pt(0, -0.9), pt(0, 0.55), 22), makeLine(pt(-0.55, -0.55), pt(0.55, -0.55), 18), makeArc(0, 0.42, 0.72, 0.44, Math.PI * 0.08, Math.PI * 0.92, 28)] },
] satisfies RecognitionTemplate[]).filter((template) =>
  template.kind === 'sigil'
    ? ACTIVE_SIGIL_SET.has(template.type as SigilType)
    : ACTIVE_SIGN_SET.has(template.type as SignType),
);

export function getCanonicalSymbolStrokes(kind: TemplateKind, type: TemplateType): Point[][] {
  const template = RECOGNITION_TEMPLATES.find(entry => entry.kind === kind && entry.type === type);
  return template ? template.strokes.map(stroke => stroke.map(point => ({ ...point }))) : [];
}

function pathLength(points: Point[]): number {
  return totalLength(points);
}

function resampleStroke(points: Point[], targetCount: number): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1 || targetCount <= 1) return [{ ...points[0] }];

  const interval = pathLength(points) / (targetCount - 1);
  if (!Number.isFinite(interval) || interval <= 0) return Array.from({ length: targetCount }, () => ({ ...points[0] }));

  const resampled: Point[] = [{ ...points[0] }];
  let distanceSinceLast = 0;
  let previous = points[0];

  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    let segmentLength = Math.hypot(current.x - previous.x, current.y - previous.y);

    while (distanceSinceLast + segmentLength >= interval && segmentLength > 0) {
      const t = (interval - distanceSinceLast) / segmentLength;
      const point = pt(
        previous.x + (current.x - previous.x) * t,
        previous.y + (current.y - previous.y) * t,
      );
      resampled.push(point);
      previous = point;
      segmentLength = Math.hypot(current.x - previous.x, current.y - previous.y);
      distanceSinceLast = 0;
    }

    distanceSinceLast += segmentLength;
    previous = current;
  }

  while (resampled.length < targetCount) resampled.push({ ...points[points.length - 1] });
  return resampled.slice(0, targetCount);
}

function resampleStrokes(strokes: Point[][], targetCount = TEMPLATE_POINT_COUNT): Point[] {
  const drawable = strokes.filter(stroke => stroke.length > 0);
  if (drawable.length === 0) return [];

  const lengths = drawable.map(pathLength);
  const total = lengths.reduce((sum, len) => sum + len, 0);
  if (total <= 0) return normalizePointCloud(drawable.flat());

  const points: Point[] = [];
  for (let i = 0; i < drawable.length; i++) {
    const count = Math.max(3, Math.round((lengths[i] / total) * targetCount));
    points.push(...resampleStroke(drawable[i], count));
  }

  if (points.length <= targetCount) return points;
  return resampleStroke(points, targetCount);
}

function normalizePointCloud(points: Point[]): Point[] {
  if (points.length === 0) return [];
  const bounds = getBounds(points);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.max(width, height);
  const center = getCenter(bounds);

  return points.map(point => pt(
    (point.x - center.x) / scale,
    (point.y - center.y) / scale,
  ));
}

function nearestDistance(point: Point, cloud: Point[]): number {
  let best = Infinity;
  for (const other of cloud) {
    best = Math.min(best, Math.hypot(point.x - other.x, point.y - other.y));
  }
  return best;
}

function cloudDistance(a: Point[], b: Point[]): number {
  if (a.length === 0 || b.length === 0) return Infinity;
  const aToB = a.reduce((sum, point) => sum + nearestDistance(point, b), 0) / a.length;
  const bToA = b.reduce((sum, point) => sum + nearestDistance(point, a), 0) / b.length;
  return (aToB + bToA) / 2;
}

function normalizeStrokes(strokes: Point[][]): Point[][] {
  const points = strokes.flat();
  if (points.length === 0) return [];

  const bounds = getBounds(points);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.max(width, height);
  const center = getCenter(bounds);

  return strokes.map(stroke => stroke.map(point => pt(
    (point.x - center.x) / scale,
    (point.y - center.y) / scale,
  )));
}

function rotateNormalizedStrokes(strokes: Point[][], angle: number): Point[][] {
  if (Math.abs(angle) < 0.0001) return strokes;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return strokes.map(stroke => stroke.map(point => pt(
    point.x * cos - point.y * sin,
    point.x * sin + point.y * cos,
  )));
}

function rasterIndex(x: number, y: number): number {
  return y * RASTER_SIZE + x;
}

function drawRasterDot(mask: Uint8Array, x: number, y: number): void {
  for (let dy = -RASTER_STROKE_RADIUS; dy <= RASTER_STROKE_RADIUS; dy++) {
    for (let dx = -RASTER_STROKE_RADIUS; dx <= RASTER_STROKE_RADIUS; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= RASTER_SIZE || py >= RASTER_SIZE) continue;
      if (dx * dx + dy * dy <= RASTER_STROKE_RADIUS * RASTER_STROKE_RADIUS + 1) {
        mask[rasterIndex(px, py)] = 1;
      }
    }
  }
}

function normalizedToRaster(point: Point): Point {
  const drawable = RASTER_SIZE - RASTER_PADDING * 2;
  return pt(
    RASTER_PADDING + (point.x + 0.5) * drawable,
    RASTER_PADDING + (point.y + 0.5) * drawable,
  );
}

function rasterizeStrokes(strokes: Point[][]): Uint8Array {
  const mask = new Uint8Array(RASTER_SIZE * RASTER_SIZE);
  const normalized = normalizeStrokes(strokes);

  for (const stroke of normalized) {
    if (stroke.length === 0) continue;
    for (let i = 1; i < stroke.length; i++) {
      const a = normalizedToRaster(stroke[i - 1]);
      const b = normalizedToRaster(stroke[i]);
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 1.6));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        drawRasterDot(mask, Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t));
      }
    }
    if (stroke.length === 1) {
      const p = normalizedToRaster(stroke[0]);
      drawRasterDot(mask, Math.round(p.x), Math.round(p.y));
    }
  }

  return mask;
}

function activePixels(mask: Uint8Array): Point[] {
  const pixels: Point[] = [];
  for (let y = 0; y < RASTER_SIZE; y++) {
    for (let x = 0; x < RASTER_SIZE; x++) {
      if (mask[rasterIndex(x, y)]) pixels.push(pt(x, y));
    }
  }
  return pixels;
}

function chamferDistance(a: Point[], b: Point[]): number {
  if (a.length === 0 || b.length === 0) return Infinity;
  const sampleStep = Math.max(1, Math.floor(a.length / 160));
  let total = 0;
  let count = 0;

  for (let i = 0; i < a.length; i += sampleStep) {
    total += nearestDistance(a[i], b);
    count++;
  }

  return total / Math.max(1, count);
}

function rasterScore(candidate: Uint8Array, template: Uint8Array): number {
  const candidatePixels = activePixels(candidate);
  const templatePixels = activePixels(template);
  if (candidatePixels.length < 8 || templatePixels.length < 8) return 0;

  const forward = chamferDistance(candidatePixels, templatePixels);
  const backward = chamferDistance(templatePixels, candidatePixels);
  const symmetric = (forward + backward) / 2;

  let intersection = 0;
  let union = 0;
  for (let i = 0; i < candidate.length; i++) {
    if (candidate[i] || template[i]) union++;
    if (candidate[i] && template[i]) intersection++;
  }
  const iou = union > 0 ? intersection / union : 0;
  const densityRatio = Math.min(candidatePixels.length, templatePixels.length) / Math.max(candidatePixels.length, templatePixels.length);

  const chamferScore = Math.max(0, 100 - symmetric * 12);
  const overlapScore = iou * 100;
  const densityScore = densityRatio * 100;

  return chamferScore * 0.62 + overlapScore * 0.23 + densityScore * 0.15;
}

function templateScore(strokes: Point[][], kind: TemplateKind): { type?: TemplateType; score: number; margin: number; secondScore: number } {
  if (resampleStrokes(strokes).length < 5) return { score: 0, margin: 0, secondScore: 0 };
  const normalizedStrokes = normalizeStrokes(strokes);
  const rotations = kind === 'sign'
    ? [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI * 0.75, -Math.PI * 0.75, Math.PI]
    : [0, Math.PI / 12, -Math.PI / 12, Math.PI / 6, -Math.PI / 6];

  let bestType: TemplateType | undefined;
  let bestScore = 0;
  let secondScore = 0;

  for (const template of RECOGNITION_TEMPLATES) {
    if (template.kind !== kind) continue;
    const templateCloud = normalizePointCloud(resampleStrokes(template.strokes));
    const templateMask = rasterizeStrokes(template.strokes);
    let score = 0;

    for (const rotation of rotations) {
      const rotatedStrokes = rotateNormalizedStrokes(normalizedStrokes, rotation);
      const rotatedCloud = normalizePointCloud(resampleStrokes(rotatedStrokes));
      const distance = cloudDistance(rotatedCloud, templateCloud);
      const pointScore = Math.max(0, 100 - (distance / 0.34) * 100);
      const imageScore = rasterScore(rasterizeStrokes(rotatedStrokes), templateMask);
      score = Math.max(score, imageScore * 0.72 + pointScore * 0.28);
    }

    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestType = template.type;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  return { type: bestType, score: bestScore, margin: bestScore - secondScore, secondScore };
}

function getShapeFeatures(points: Point[]): ShapeFeatures {
  const bounds = getBounds(points);
  const area = polygonArea(points);
  const convexArea = convexHullArea(points);
  const convexity = convexArea > 0 ? area / convexArea : 0;
  const closed = isClosedShape(points);
  return {
    corners: countCorners(points, -0.4, closed),
    aspect: Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) > 0
      ? Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
      : 1,
    convexity,
    curvatureVar: calculateCurvatureVariance(points),
    straightness: calculateStraightness(points),
    area,
    closed,
    strokeLen: totalLength(points),
    circularity: calculateCircularity(points),
  };
}

function isPlausibleRecognition(type: TemplateType, kind: TemplateKind, features: ShapeFeatures, distanceFromCenter: number, ringRadius: number): boolean {
  const normalizedDistance = Math.min(1.3, distanceFromCenter / Math.max(80, ringRadius));

  if (kind === 'sigil') {
    if (normalizedDistance > 0.62) return false;
    if (type === 'fire') return features.closed && features.corners >= 2 && features.corners <= 5 && features.aspect <= 2.0;
    if (type === 'thunder') return !features.closed && features.corners >= 2 && features.aspect >= 1.05 && features.curvatureVar < 0.12;
    if (type === 'nature') return features.closed && features.aspect >= 1.15 && features.aspect <= 2.8 && features.curvatureVar > 0.018;
    if (type === 'void') return features.closed && features.circularity > 0.35 && features.area < 5000;
    return true;
  }

  if (normalizedDistance < 0.12) return false;
  if (type === 'chain') return features.closed && features.aspect >= 1.45 && features.circularity > 0.28 && features.corners <= 2;
  if (type === 'direction') return !features.closed && features.aspect >= 1.15 && features.straightness > 0.22;
  if (type === 'enlarge') return features.closed && features.corners >= 3 && features.aspect >= 1.1;
  if (type === 'float') return features.closed && features.circularity > 0.38 && features.corners <= 2;
  if (type === 'collection' || type === 'spiral') return !features.closed && features.curvatureVar > 0.018 && features.strokeLen > 70;
  return true;
}

function isLikelyCentralThunder(features: ShapeFeatures, normalizedDistance: number): boolean {
  return normalizedDistance <= 0.46
    && !features.closed
    && features.corners >= 2
    && features.corners <= 8
    && features.aspect >= 1.05
    && features.curvatureVar < 0.2
    && features.circularity < 0.34
    && features.strokeLen > 48;
}

function isLikelyOuterDirection(features: ShapeFeatures, normalizedDistance: number): boolean {
  return normalizedDistance >= 0.22
    && !features.closed
    && features.corners >= 1
    && features.corners <= 5
    && features.aspect >= 1.12
    && features.straightness > 0.18
    && features.strokeLen > 42;
}

function recognizeGroup(
  strokes: DrawingStroke[],
  firstIndex: number,
  canvasCenter: Point,
  ringRadius: number,
): RecognizedGroup | null {
  const strokePoints = strokes.map(stroke => stroke.points);
  const points = strokePoints.flat();
  if (points.length < 5) return null;

  const bounds = getBounds(points);
  const center = getCenter(bounds);
  const distanceFromCenter = Math.hypot(center.x - canvasCenter.x, center.y - canvasCenter.y);
  const features = getShapeFeatures(points);

  const sigilTemplate = templateScore(strokePoints, 'sigil');
  const signTemplate = templateScore(strokePoints, 'sign');
  const sigilHeuristic = classifySigil(points, features);
  const signHeuristic = classifySign(points, features);

  let sigilScore = sigilTemplate.score;
  let signScore = signTemplate.score;
  let sigilType = sigilTemplate.type as SigilType | undefined;
  let signType = signTemplate.type as SignType | undefined;
  let sigilAgrees = false;
  let signAgrees = false;

  if (isActiveSigilType(sigilHeuristic.sigilType)) {
    if (sigilHeuristic.sigilType === sigilType) {
      sigilAgrees = true;
      sigilScore = sigilScore * 0.72 + sigilHeuristic.precision * 0.28;
    }
    else if (sigilHeuristic.precision > sigilScore + 18) {
      sigilType = sigilHeuristic.sigilType;
      sigilScore = sigilHeuristic.precision * 0.72;
    }
  }

  if (isActiveSignType(signHeuristic.signType)) {
    if (signHeuristic.signType === signType) {
      signAgrees = true;
      signScore = signScore * 0.72 + signHeuristic.precision * 0.28;
    }
    else if (signHeuristic.precision > signScore + 18) {
      signType = signHeuristic.signType;
      signScore = signHeuristic.precision * 0.72;
    }
  }

  const safeRingRadius = Math.max(80, ringRadius);
  const normalizedDistance = Math.min(1.3, distanceFromCenter / safeRingRadius);

  sigilScore += Math.max(0, (0.5 - normalizedDistance) * 36);
  signScore += normalizedDistance > 0.28 ? Math.min(14, normalizedDistance * 12) : -8;

  const centralThunderOverride = isLikelyCentralThunder(features, normalizedDistance);
  const outerDirectionOverride = isLikelyOuterDirection(features, normalizedDistance);

  if (centralThunderOverride && ACTIVE_SIGIL_SET.has('thunder')) {
    sigilType = 'thunder';
    sigilScore = Math.max(sigilScore, 94);
  }
  if (outerDirectionOverride && ACTIVE_SIGN_SET.has('direction')) {
    signType = 'direction';
    signScore = Math.max(signScore, 96);
  }

  const kind: TemplateKind = sigilScore >= signScore ? 'sigil' : 'sign';
  const type = kind === 'sigil' ? sigilType : signType;
  const score = Math.max(sigilScore, signScore);
  const template = kind === 'sigil' ? sigilTemplate : signTemplate;
  const agrees = kind === 'sigil' ? sigilAgrees : signAgrees;
  const heuristicPrecision = kind === 'sigil' ? sigilHeuristic.precision : signHeuristic.precision;
  const competingScore = kind === 'sigil' ? signScore : sigilScore;
  const structuralOverride = (kind === 'sigil' && centralThunderOverride) || (kind === 'sign' && outerDirectionOverride);

  if (!type) return null;
  if (kind === 'sigil' && !isActiveSigilType(type)) return null;
  if (kind === 'sign' && !isActiveSignType(type)) return null;
  if (!isPlausibleRecognition(type, kind, features, distanceFromCenter, ringRadius)) return null;
  if (score < 66) return null;
  if (!structuralOverride && score - competingScore < 9) return null;
  if (!structuralOverride && template.score < 55 && !agrees) return null;
  if (!structuralOverride && template.margin < 6 && heuristicPrecision < 72) return null;
  if (kind === 'sigil' && normalizedDistance > 0.58 && score < 82) return null;
  if (kind === 'sign' && normalizedDistance < 0.16 && score < 78) return null;

  return {
    kind,
    type,
    strokes,
    points,
    score: Math.min(100, Math.max(0, score)),
    firstIndex,
    lastIndex: firstIndex + strokes.length - 1,
    indexes: Array.from({ length: strokes.length }, (_, offset) => firstIndex + offset),
  };
}

function canGroupStrokes(strokes: DrawingStroke[], ringRadius: number): boolean {
  if (strokes.length <= 1) return true;
  const points = strokes.flatMap(stroke => stroke.points);
  const bounds = getBounds(points);
  const diagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  if (diagonal > Math.max(96, ringRadius * 0.52)) return false;

  for (let i = 1; i < strokes.length; i++) {
    const currentCenter = getCenter(getBounds(strokes[i].points));
    let hasNeighbor = false;
    for (let j = 0; j < i; j++) {
      const neighborCenter = getCenter(getBounds(strokes[j].points));
      if (Math.hypot(currentCenter.x - neighborCenter.x, currentCenter.y - neighborCenter.y) <= Math.max(44, ringRadius * 0.22)) {
        hasNeighbor = true;
        break;
      }
    }
    if (!hasNeighbor) return false;
  }

  return true;
}

function pushRecognizedCandidate(
  candidates: RecognizedGroup[],
  groupStrokes: DrawingStroke[],
  groupIndexes: number[],
  canvasCenter: Point,
  ringRadius: number,
): void {
  if (!canGroupStrokes(groupStrokes, ringRadius)) return;
  const sortedIndexes = [...groupIndexes].sort((a, b) => a - b);
  const group = recognizeGroup(groupStrokes, sortedIndexes[0], canvasCenter, ringRadius);
  if (!group) return;
  group.firstIndex = sortedIndexes[0];
  group.lastIndex = sortedIndexes[sortedIndexes.length - 1];
  group.indexes = sortedIndexes;
  candidates.push(group);
}

function groupToComponent(group: RecognizedGroup): GlyphComponent {
  const bounds = getBounds(group.points);
  const componentType = group.kind === 'sigil' ? 'sigil' : 'sign';
  return {
    id: uuidv4(),
    type: componentType,
    sigilType: componentType === 'sigil' ? group.type as SigilType : undefined,
    signType: componentType === 'sign' ? group.type as SignType : undefined,
    points: group.points,
    center: getCenter(bounds),
    bounds,
    precision: Math.round(group.score),
    size: Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY),
  };
}

function componentDistanceFrom(component: GlyphComponent, point: Point): number {
  return Math.hypot(component.center.x - point.x, component.center.y - point.y);
}

function componentAngleFrom(component: GlyphComponent, point: Point): number {
  const angle = Math.atan2(component.center.y - point.y, component.center.x - point.x);
  return angle < 0 ? angle + Math.PI * 2 : angle;
}

export function analyzeGlyphFromStrokes(
  strokes: DrawingStroke[],
  canvasCenter: Point,
): { components: GlyphComponent[]; precision: PrecisionBreakdown } {
  const cleanStrokes = strokes
    .filter(stroke => stroke.points.length >= 5);

  let ringIndex = -1;
  let ringComponent: GlyphComponent | null = null;
  let bestRingScore = 0;

  for (let i = 0; i < cleanStrokes.length; i++) {
    const rawClosureDistance = cleanStrokes[i].rawClosureDistance ?? getClosureDistance(cleanStrokes[i].points);
    const analysis = analyzeStroke(closeStrokeIfNear(cleanStrokes[i].points, 42), canvasCenter);
    if (!analysis.isRing) continue;
    const diameter = Math.max(analysis.bounds.maxX - analysis.bounds.minX, analysis.bounds.maxY - analysis.bounds.minY);
    const recency = i / Math.max(1, cleanStrokes.length - 1);
    const quality = analyzeRingQuality(analysis.points, canvasCenter, rawClosureDistance);
    const score = quality.precision + diameter * 0.06 + recency * 14;
    if (score > bestRingScore) {
      bestRingScore = score;
      ringIndex = i;
      ringComponent = { ...strokeToComponent(analysis), precision: quality.precision, rawClosureDistance };
    }
  }

  const ringRadius = ringComponent
    ? Math.max(ringComponent.bounds.maxX - ringComponent.bounds.minX, ringComponent.bounds.maxY - ringComponent.bounds.minY) / 2
    : 160;

  const drawableStrokes = cleanStrokes.filter((_, index) => index !== ringIndex);
  const originalIndexes = cleanStrokes
    .map((_, index) => index)
    .filter(index => index !== ringIndex);
  const candidates: RecognizedGroup[] = [];

  for (let i = 0; i < drawableStrokes.length; i++) {
    pushRecognizedCandidate(candidates, [drawableStrokes[i]], [originalIndexes[i]], canvasCenter, ringRadius);

    for (let j = i + 1; j < drawableStrokes.length; j++) {
      pushRecognizedCandidate(
        candidates,
        [drawableStrokes[i], drawableStrokes[j]],
        [originalIndexes[i], originalIndexes[j]],
        canvasCenter,
        ringRadius,
      );

      for (let k = j + 1; k < drawableStrokes.length; k++) {
        pushRecognizedCandidate(
          candidates,
          [drawableStrokes[i], drawableStrokes[j], drawableStrokes[k]],
          [originalIndexes[i], originalIndexes[j], originalIndexes[k]],
          canvasCenter,
          ringRadius,
        );
      }
    }
  }

  candidates.sort((a, b) => {
    const multiStrokeBonus = (b.strokes.length - a.strokes.length) * 3;
    return (b.score - a.score) + multiStrokeBonus;
  });

  const usedIndexes = new Set<number>();
  const selected: RecognizedGroup[] = [];
  for (const candidate of candidates) {
    const indexes = candidate.indexes;
    if (indexes.some(index => usedIndexes.has(index))) continue;
    selected.push(candidate);
    indexes.forEach(index => usedIndexes.add(index));
  }

  const ordered = selected
    .filter(group => group.score >= 66)
    .sort((a, b) => a.firstIndex - b.firstIndex);
  const sigilLimit = 3;
  const signLimit = 4;
  let sigilCount = 0;
  let signCount = 0;
  const capped = ordered.filter(group => {
    if (group.kind === 'sigil') {
      sigilCount++;
      return sigilCount <= sigilLimit;
    }
    signCount++;
    return signCount <= signLimit;
  });

  const recognizedComponents = capped.map(groupToComponent);
  const sigilComponents = recognizedComponents
    .filter(component => component.type === 'sigil')
    .sort((a, b) => {
      const distanceScore = componentDistanceFrom(a, canvasCenter) - componentDistanceFrom(b, canvasCenter);
      if (Math.abs(distanceScore) > 12) return distanceScore;
      return b.precision - a.precision;
    });
  const signComponents = recognizedComponents
    .filter(component => component.type === 'sign')
    .sort((a, b) => {
      const precisionScore = b.precision - a.precision;
      if (Math.abs(precisionScore) > 8) return precisionScore;
      return componentAngleFrom(a, canvasCenter) - componentAngleFrom(b, canvasCenter);
    });

  const components = [
    ...sigilComponents,
    ...signComponents,
    ...(ringComponent ? [ringComponent] : []),
  ];

  const sigils = components.filter(component => component.type === 'sigil');
  const signs = components.filter(component => component.type === 'sign');
  const precision = calculateGlyphPrecision(ringComponent, sigils, signs, canvasCenter);

  return { components, precision };
}

// ============================================
// STROKE TO COMPONENT CONVERSION
// ============================================

export function strokeToComponent(analysis: StrokeAnalysis): GlyphComponent {
  return {
    id: uuidv4(),
    type: analysis.isSigil ? 'sigil' : analysis.isSign ? 'sign' : 'ring',
    sigilType: analysis.sigilType,
    signType: analysis.signType,
    points: analysis.points,
    center: analysis.center,
    bounds: analysis.bounds,
    precision: analysis.precision,
    size: Math.max(analysis.bounds.maxX - analysis.bounds.minX, analysis.bounds.maxY - analysis.bounds.minY),
  };
}
