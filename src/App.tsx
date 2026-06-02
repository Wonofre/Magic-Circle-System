import { useState, useCallback, useEffect, useRef } from 'react';
import type { DrawingStroke, GlyphComponent, PrecisionBreakdown, GamePhase, Entity, SpellEffect } from '@/types/magic';
import type { SigilType } from '@/types/magic';
import {
  getWeaknessMultiplier,
  generateEnemy,
} from '@/lib/spellEngine';
import type { CastResult } from '@/lib/spellEngine';
import { turnPresentationTimings } from '@/lib/ui/turnPresentationDirector';
import {
  calculateSpellCardInkCost,
  DEFAULT_PLAYER_INK,
  getInkReservoir,
  regenerateInk,
  simulateInkSpend,
  spendInk,
} from '@/lib/spell/inkSimulator';
import { chooseEnemySpellPlan, type EnemySpellPlan } from '@/lib/spell/enemySpellAI';
import {
  defaultGrimoireLoadout,
  loadCodexEntries,
  recordSpellCardDiscovery,
  saveCodexEntries,
  validateSpellCardForLoadout,
} from '@/lib/spell/codexStore';
import { resolveDiegeticFailure } from '@/lib/recognizer/failureResolver';
import { activeRuneDefinitions, getLegacySigilForTemplateId } from '@/data/magicOntology';
import { getGlyphById } from '@/data/glyphTemplates';
import { compileSpellFromStrokes } from '@/lib/spell/spellCompiler';
import { compileSpellFromLegacyComponents } from '@/lib/spell/legacyGlyphAdapter';
import { drawingStrokesToRecognitionStrokes } from '@/lib/spell/strokeAdapter';
import { createRecognitionTelemetryEvent, cloneTelemetryStrokes } from '@/lib/telemetry/recognitionTelemetry';
import { riskLabels, roleLabels } from '@/lib/ui/runeCatalogPresentation';
import { GameCanvas } from '@/components/GameCanvas';
import { SpellEffectDisplay } from '@/components/SpellEffect';
import { CodexPanel } from '@/components/CodexPanel';
import { GuidePanel } from '@/components/GuidePanel';
import { PerfectGlyphPreview } from '@/components/PerfectGlyphPreview';
import { BattleSceneShell } from '@/components/BattleSceneShell';
import {
  BookOpen, HelpCircle,
  Trophy, Skull, RotateCcw, Sparkles, ChevronRight,
  Circle,
  Hexagon, Key, Shield
} from 'lucide-react';
import './App.css';
import type { DiegeticFailureResolution } from '@/lib/recognizer/failureResolver';
import type { GlyphTemplate } from '@/types/glyphTemplates';
import type { RecognitionTelemetryEvent } from '@/types/telemetry';
import type { SpellCard } from '@/types/spellCard';

const elementColors: Record<SigilType, string> = {
  fire:    'rgb(232, 93, 62)',
  water:   'rgb(59, 141, 212)',
  earth:   'rgb(139, 111, 71)',
  wind:    'rgb(126, 200, 160)',
  light:   'rgb(240, 208, 96)',
  ice:     'rgb(136, 212, 238)',
  shadow:  'rgb(155, 107, 204)',
  thunder: 'rgb(224, 208, 32)',
  nature:  'rgb(68, 204, 102)',
  void:    'rgb(136, 102, 170)',
};

const elementLabels: Record<SigilType, string> = {
  fire: 'Ignis',
  water: 'Aqua',
  earth: 'Terra',
  wind: 'Ventus',
  light: 'Lux',
  ice: 'Gelu',
  shadow: 'Umbra',
  thunder: 'Fulmen',
  nature: 'Vita',
  void: 'Vacuus',
};

const menuRuneEntries = activeRuneDefinitions
  .filter((entry) =>
    defaultGrimoireLoadout.knownGlyphIds.includes(entry.templateId) &&
    (entry.role === 'element' || entry.role === 'derived')
  )
  .slice(0, 10);

const menuDefaultRuneEntries = activeRuneDefinitions.filter((entry) => entry.canBeDefaulted);

const getGlyphBounds = (glyph: GlyphTemplate) => {
  const points = glyph.strokes.flat();
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
};

function MenuGlyphPreview({ templateId, legacySigil }: { readonly templateId: string; readonly legacySigil?: SigilType }) {
  if (legacySigil) {
    return <PerfectGlyphPreview mode="sigil" type={legacySigil} size={34} strokeWidth={3} />;
  }

  const glyph = getGlyphById(templateId);
  if (!glyph) return <Sparkles className="w-5 h-5 text-amber-400" />;

  const bounds = getGlyphBounds(glyph);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const size = 34;
  const pad = 6;
  const scale = (size - pad * 2) / Math.max(width, height);
  const offsetX = (size - width * scale) / 2;
  const offsetY = (size - height * scale) / 2;
  const project = ([x, y]: readonly [number, number]) =>
    `${offsetX + (x - bounds.minX) * scale},${offsetY + (y - bounds.minY) * scale}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-amber-300 overflow-visible">
      {glyph.strokes.map((stroke, index) => (
        <polyline
          key={`${glyph.id}-${index}`}
          points={stroke.map(project).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

const PLAYER_CAST_RESULT_DELAY_MS = turnPresentationTimings.playerCastImpactDelay;
const PLAYER_CAST_PHASE_ADVANCE_DELAY_MS = turnPresentationTimings.playerCastPhaseAdvanceDelay;
const ENEMY_CAST_START_DELAY_MS = turnPresentationTimings.enemyTelegraphDelay;
const ENEMY_RESULT_DELAY_MS = turnPresentationTimings.enemyResultDelay;
const DEFEAT_RESULT_DELAY_MS = turnPresentationTimings.defeatResultDelay;
const INK_PER_DRAW_PIXEL = 1 / 320;

type GameplayCastResult = CastResult & {
  spellCard?: SpellCard;
  spellHash?: string;
  componentTemplateIds?: readonly string[];
  diegeticFailure?: DiegeticFailureResolution;
  telemetry?: RecognitionTelemetryEvent;
};

const getPrimarySigilFromCard = (card: SpellCard): SigilType | undefined => {
  const elementNode = card.graph.nodes.find((node) => node.kind === 'element');
  return elementNode ? getLegacySigilForTemplateId(elementNode.templateId) : undefined;
};

const effectSummaryFromCard = (card: SpellCard): string => {
  return `${card.effectSummary} Potencia ${card.potency}.`;
};

const makeFailureResult = (
  spellName: string,
  description: string,
  feedback: string,
  precision: number,
  extra: Partial<GameplayCastResult> = {},
): GameplayCastResult => ({
  spellName,
  description,
  damage: 0,
  healing: 0,
  shield: 0,
  effects: [],
  accuracy: 0,
  precision,
  isSuccess: false,
  feedback,
  elementalMultiplier: 0,
  inkCost: 0,
  ...extra,
});

const buildCastResultFromCard = (
  card: SpellCard,
  precision: number,
  target: Entity,
  inkCost: number,
  inkRemaining: number,
  inkOverloadChance: number,
  telemetry?: RecognitionTelemetryEvent,
): GameplayCastResult => {
  const primarySigil = card.effectProfile.element ?? getPrimarySigilFromCard(card);
  const precisionFactor = Math.max(0.35, precision / 100);
  const elementalMultiplier = primarySigil && (card.target === 'enemy' || card.target === 'default_enemy' || card.target === 'area')
    ? getWeaknessMultiplier(primarySigil, target.weakness)
    : 1;
  const adjustedPotency = Math.round(card.potency * precisionFactor);
  const isSelfTarget = card.effectProfile.area === 'self' || card.target === 'self';
  const damage = isSelfTarget || card.effectProfile.damageScale <= 0
    ? 0
    : Math.round(adjustedPotency * elementalMultiplier * card.effectProfile.damageScale);
  const healing = card.effectProfile.healingScale > 0 ? Math.max(4, Math.round(adjustedPotency * card.effectProfile.healingScale)) : 0;
  const shield = card.effectProfile.shieldScale > 0 ? Math.max(5, Math.round(adjustedPotency * card.effectProfile.shieldScale)) : 0;
  const effects: SpellEffect[] = primarySigil
    ? [{
        element: primarySigil,
        form: card.effectProfile.form,
        power: card.potency,
        potency: Math.max(damage, healing, shield, adjustedPotency),
        accuracy: precision,
        area: card.effectProfile.area,
        special: effectSummaryFromCard(card),
      }]
    : [];

  return {
    spellName: card.name,
    description: effectSummaryFromCard(card),
    damage,
    healing,
    shield,
    effects,
    accuracy: precision,
    precision,
    isSuccess: damage > 0 || healing > 0 || shield > 0,
    feedback: card.recognitionOutcome === 'cast_weak'
      ? 'A formula compilou, mas o circulo perdeu estabilidade.'
      : `Formula ${card.formula.formulaHash} estabilizada pelo circulo (${card.formula.circleQuality.overall}%).`,
    elementalMultiplier,
    inkCost,
    inkRemaining,
    inkOverloadChance,
    inkCostBreakdown: calculateSpellCardInkCost({ card }),
    primarySigil,
    spellCard: card,
    spellHash: card.id,
    componentTemplateIds: card.componentTemplateIds,
    telemetry,
  };
};

export default function App() {
  const [gamePhase, setGamePhase] = useState<GamePhase>('menu');
  const [player, setPlayer] = useState<Entity>({
    id: 'player',
    name: 'Aprendiz de Bruxa',
    hp: 100,
    maxHp: 100,
    shield: 0,
    ink: DEFAULT_PLAYER_INK.ink,
    maxInk: DEFAULT_PLAYER_INK.maxInk,
    inkRegenPerTurn: DEFAULT_PLAYER_INK.inkRegenPerTurn,
    inkPurity: DEFAULT_PLAYER_INK.inkPurity,
    inkViscosity: DEFAULT_PLAYER_INK.inkViscosity,
    inkVolatility: DEFAULT_PLAYER_INK.inkVolatility,
    inkAffinity: DEFAULT_PLAYER_INK.inkAffinity,
    activeInfusionIds: DEFAULT_PLAYER_INK.activeInfusionIds,
    element: null,
    weakness: null,
    resistance: null,
    status: [],
    isPlayer: true,
  });
  const [enemy, setEnemy] = useState<Entity>({
    id: 'enemy-1',
    name: 'Slime de Sombra',
    hp: 55,
    maxHp: 55,
    shield: 0,
    ink: 9,
    maxInk: 9,
    inkRegenPerTurn: 2,
    inkPurity: 0.9,
    inkViscosity: 0.55,
    inkVolatility: 0.18,
    inkAffinity: null,
    activeInfusionIds: [],
    element: null,
    weakness: 'light',
    resistance: 'earth',
    status: [],
    isPlayer: false,
  });
  const [turn, setTurn] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(45);
  const [currentComponents, setCurrentComponents] = useState<GlyphComponent[]>([]);
  const [currentPrecision, setCurrentPrecision] = useState<PrecisionBreakdown | null>(null);
  const [currentStrokes, setCurrentStrokes] = useState<DrawingStroke[]>([]);
  const [castResult, setCastResult] = useState<GameplayCastResult | null>(null);
  const [codexEntries, setCodexEntries] = useState(loadCodexEntries);
  const [showCodex, setShowCodex] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [enemyAction, setEnemyAction] = useState<string>('');
  const [enemyCastPlan, setEnemyCastPlan] = useState<EnemySpellPlan | null>(null);
  const [drawingInkSpent, setDrawingInkSpent] = useState(0);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [detectedRuneIds, setDetectedRuneIds] = useState<string[]>([]);
  const [detectedFormula, setDetectedFormula] = useState('');
  const [canvasGlowColor, setCanvasGlowColor] = useState('rgb(180, 140, 80)');
  const [canvasElementName, setCanvasElementName] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasResetRef = useRef(false);
  const appliedCastRef = useRef<GameplayCastResult | null>(null);
  const drawingInkSpentRef = useRef(0);
  const playerInkRef = useRef(player.ink);

  const addLog = useCallback((msg: string) => {
    setLogMessages(prev => [msg, ...prev].slice(0, 20));
  }, []);

  useEffect(() => {
    saveCodexEntries(codexEntries);
  }, [codexEntries]);

  const resetCanvas = useCallback(() => {
    if ((window as unknown as Record<string, unknown>).__resetCanvas) {
      ((window as unknown as Record<string, unknown>).__resetCanvas as () => void)();
    }
    canvasResetRef.current = true;
  }, []);

  const finalizeCanvas = useCallback(() => {
    const finalize = (window as unknown as Record<string, unknown>).__finalizeCanvas as (() => boolean) | undefined;
    return finalize ? finalize() : false;
  }, []);

  useEffect(() => {
    playerInkRef.current = player.ink;
  }, [player.ink]);

  const startGame = useCallback(() => {
    setGamePhase('drawing');
    setPlayer(p => ({ ...p, hp: p.maxHp, shield: 0, ink: p.maxInk }));
    setEnemy(generateEnemy(1));
    setTurn(1);
    setCombo(0);
    setScore(0);
    setRound(1);
    setEnemyCastPlan(null);
    drawingInkSpentRef.current = 0;
    setDrawingInkSpent(0);
    setTimeRemaining(45);
    setCurrentComponents([]);
    setCurrentPrecision(null);
    setCurrentStrokes([]);
    setCastResult(null);
    appliedCastRef.current = null;
    setLogMessages([]);
    setDetectedRuneIds([]);
    setDetectedFormula('');
    resetCanvas();
    addLog('A batalha começou! Desenhe seu primeiro glifo.');
  }, [addLog, resetCanvas]);

  const evaluateCurrentGlyph = useCallback((
    componentsOverride: GlyphComponent[] = currentComponents,
    precisionOverride: PrecisionBreakdown | null = currentPrecision,
    strokesOverride: DrawingStroke[] = currentStrokes,
  ) => {
    const precision = precisionOverride?.overall || 50;
    if (componentsOverride.length === 0) {
      setCastResult(makeFailureResult(
        'Falha Magica',
        'Nenhum glifo foi desenhado.',
        'O tempo acabou antes que voce pudesse desenhar.',
        0,
      ));
      setGamePhase('casting');
      return;
    }

    const recognitionStrokes = drawingStrokesToRecognitionStrokes(strokesOverride);
    let compiled = compileSpellFromStrokes(recognitionStrokes);
    let telemetry = compiled.telemetry;

    if (!compiled.ok) {
      const primaryFailure = compiled.failure;
      const legacyCompiled = compileSpellFromLegacyComponents(componentsOverride, precision);

      if (legacyCompiled.ok) {
        telemetry = createRecognitionTelemetryEvent({
          rawStrokes: cloneTelemetryStrokes(recognitionStrokes),
          match: primaryFailure.match,
          topology: primaryFailure.topology,
          semanticResults: legacyCompiled.semanticResults,
          failure: primaryFailure,
          decision: 'legacy_bridge_fallback',
          context: { source: 'player' },
          fallbackUsed: 'legacy_bridge',
        });
        compiled = {
          ...legacyCompiled,
          telemetry,
        };
      }
    }

    if (!compiled.ok) {
      const failure = compiled.failure;
      setCastResult(makeFailureResult(
        'Falha de Compilacao',
        failure.message,
        failure.diegeticFailure?.playerFeedback ?? failure.message,
        precision,
        {
          diegeticFailure: failure.diegeticFailure,
          telemetry,
        },
      ));
      setGamePhase('casting');
      return;
    }

    const card = compiled.card;
    setDetectedRuneIds([...card.drawnTemplateIds]);
    setDetectedFormula(card.formula.formulaReading);
    const primaryElement = card.formula.elements[0];
    if (card.effectProfile.element) {
      setCanvasGlowColor(elementColors[card.effectProfile.element]);
      setCanvasElementName(primaryElement?.name ?? elementLabels[card.effectProfile.element]);
    } else if (primaryElement) {
      setCanvasElementName(primaryElement.name);
    }
    const loadoutValidation = validateSpellCardForLoadout(card, defaultGrimoireLoadout, codexEntries);

    if (!loadoutValidation.ok) {
      setCastResult(makeFailureResult(
        'Codex Recusou',
        loadoutValidation.message,
        loadoutValidation.message,
        precision,
        {
          spellCard: card,
          spellHash: card.id,
          componentTemplateIds: card.componentTemplateIds,
          telemetry,
        },
      ));
      setGamePhase('casting');
      return;
    }

    const casterBeforeDrawing = {
      ...player,
      ink: Math.min(player.maxInk, player.ink + drawingInkSpentRef.current),
    };
    const inkBreakdown = calculateSpellCardInkCost({ card });
    const inkSimulation = simulateInkSpend(getInkReservoir(casterBeforeDrawing), inkBreakdown);

    if (!inkSimulation.ok) {
      const diegeticFailure = resolveDiegeticFailure({
        ink: inkSimulation,
        strokes: recognitionStrokes,
      });
      setCastResult(makeFailureResult(
        'Tinta Insuficiente',
        inkSimulation.message ?? 'A tinta acabou antes de alimentar a formula.',
        diegeticFailure.playerFeedback,
        precision,
        {
          spellCard: card,
          spellHash: card.id,
          componentTemplateIds: card.componentTemplateIds,
          diegeticFailure,
          inkFailure: inkSimulation.message,
          inkOverloadChance: inkSimulation.overloadChance,
          inkCostBreakdown: inkSimulation.breakdown,
          telemetry,
        },
      ));
      setGamePhase('casting');
      return;
    }

    const circleQuality = card.mandala?.circleQuality.overall ?? card.formula.circleQuality.overall;
    const finalPrecision = Math.round(precision * 0.25 + card.stability * 0.45 + circleQuality * 0.30);
    setCastResult(buildCastResultFromCard(
      card,
      finalPrecision,
      enemy,
      inkSimulation.cost,
      inkSimulation.remainingInk,
      inkSimulation.overloadChance,
      telemetry,
    ));
    setGamePhase('casting');
    return;
  }, [currentComponents, currentPrecision, currentStrokes, codexEntries, enemy, player]);

  const handleInkDrag = useCallback((distance: number) => {
    const requestedInk = distance * INK_PER_DRAW_PIXEL;
    const spent = Math.min(playerInkRef.current, requestedInk);

    if (spent <= 0) return 0;

    playerInkRef.current = Number(Math.max(0, playerInkRef.current - spent).toFixed(2));
    drawingInkSpentRef.current += spent;
    setDrawingInkSpent(drawingInkSpentRef.current);
    setPlayer(current => ({
      ...current,
      ink: Number(Math.max(0, current.ink - spent).toFixed(2)),
    }));

    return spent;
  }, []);

  // Timer
  useEffect(() => {
    if (gamePhase !== 'drawing') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (!finalizeCanvas()) evaluateCurrentGlyph();
          return 45;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gamePhase, evaluateCurrentGlyph, finalizeCanvas]);

  const handleGlyphComplete = useCallback((components: GlyphComponent[], precision: PrecisionBreakdown, strokes: DrawingStroke[]) => {
    setCurrentComponents(components);
    setCurrentPrecision(precision);
    setCurrentStrokes(strokes);

    const sigils = components.filter(c => c.type === 'sigil').map(c => c.sigilType!).filter(Boolean);
    if (sigils.length > 0) {
      setCanvasGlowColor(elementColors[sigils[0]]);
      setCanvasElementName(elementLabels[sigils[0]]);
    }

    setTimeout(() => {
      evaluateCurrentGlyph(components, precision, strokes);
    }, turnPresentationTimings.glyphReadDelay);
  }, [evaluateCurrentGlyph]);

  // Apply cast result
  useEffect(() => {
    if (gamePhase !== 'casting' || !castResult) return;
    if (appliedCastRef.current === castResult) return;
    appliedCastRef.current = castResult;

    const timeout = setTimeout(() => {
      const remainingInkCost = Math.max(0, castResult.inkCost - drawingInkSpentRef.current);

      if (remainingInkCost > 0) {
        setPlayer(p => spendInk(p, remainingInkCost));
      }

      if (castResult.isSuccess) {
        const actualDamage = castResult.damage;
        const shieldAbsorb = Math.min(actualDamage, enemy.shield);
        const hpDamage = actualDamage - shieldAbsorb;

        setEnemy(e => ({
          ...e,
          hp: Math.max(0, e.hp - hpDamage),
          shield: Math.max(0, e.shield - shieldAbsorb),
        }));

        if (castResult.healing > 0) {
          setPlayer(p => ({ ...p, hp: Math.min(p.maxHp, p.hp + castResult.healing) }));
        }
        if (castResult.shield > 0) {
          setPlayer(p => ({ ...p, shield: p.shield + castResult.shield }));
        }

        setCombo(prev => prev + 1);
        setScore(prev => prev + actualDamage * (1 + combo * 0.1));

        if (castResult.spellCard) {
          setCodexEntries(entries => recordSpellCardDiscovery(entries, castResult.spellCard!));
          addLog(`Codex registrou ${castResult.spellCard.name} (${castResult.spellHash}).`);
        }


        addLog(`Você lançou ${castResult.spellName} causando ${actualDamage} de dano. Tinta: -${castResult.inkCost}.`);
      } else {
        setCombo(0);
        addLog(`A magia falhou... ${castResult.feedback}${castResult.inkFailure ? ` ${castResult.inkFailure}` : ''}`);
      }

      setTimeout(() => {
        setEnemy(e => {
          if (e.hp <= 0) {
            addLog(`Você derrotou ${e.name}!`);
            setGamePhase('victory');
            return e;
          } else {
            setGamePhase('enemy_turn');
            return e;
          }
        });
      }, PLAYER_CAST_PHASE_ADVANCE_DELAY_MS);
    }, PLAYER_CAST_RESULT_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [gamePhase, castResult, enemy.hp, enemy.shield, combo, addLog]);

  // Enemy turn
  useEffect(() => {
    if (gamePhase !== 'enemy_turn') return;

    const timeout = setTimeout(() => {
      const plan = chooseEnemySpellPlan(enemy, player, { turn });
      setEnemyCastPlan(plan);
      setEnemyAction(plan.effectText);
      addLog(`${plan.spellName}: ${plan.effectText}`);
      const inkBreakdown = {
        base: plan.expectedInkCost,
        complexity: Math.max(0, plan.templateIds.length - 4),
        stability: plan.profile === 'apprentice' ? 1 : 0,
        risk: plan.intent === 'desperate' ? 2 : 0,
        infusion: 0,
        total: plan.expectedInkCost,
      };
      const inkSimulation = simulateInkSpend(getInkReservoir(enemy), inkBreakdown);

      if (!inkSimulation.ok) {
        addLog(inkSimulation.message ?? `${enemy.name} ficou sem tinta antes de concluir o traco.`);
        setTimeout(() => {
          setTurn(t => t + 1);
          setTimeRemaining(45);
          setGamePhase('drawing');
          setEnemyCastPlan(null);
          setPlayer(current => regenerateInk(current));
          setEnemy(current => regenerateInk(current));
          drawingInkSpentRef.current = 0;
          setDrawingInkSpent(0);
          resetCanvas();
        }, ENEMY_RESULT_DELAY_MS);
        return;
      }

      setEnemy(e => spendInk(e, inkSimulation.cost));

      if (plan.intent === 'defense') {
        setEnemy(e => ({ ...e, shield: e.shield + Math.round(plan.expectedPower * 0.8) }));
        addLog(`${enemy.name} ergueu ${Math.round(plan.expectedPower * 0.8)} de escudo.`);
      }

      if (plan.intent === 'recover') {
        setEnemy(e => ({ ...e, hp: Math.min(e.maxHp, e.hp + Math.round(plan.expectedPower * 0.7)) }));
        addLog(`${enemy.name} recuperou ${Math.round(plan.expectedPower * 0.7)} de vida.`);
      }

      const damage = plan.intent === 'attack' || plan.intent === 'desperate' || plan.intent === 'control'
        ? Math.round(plan.expectedPower * (plan.intent === 'control' ? 0.65 : 1))
        : 0;

      setPlayer(p => {
        const shieldAbsorb = Math.min(damage, p.shield);
        const hpDamage = damage - shieldAbsorb;
        if (p.shield > 0) addLog(`Seu escudo absorveu ${shieldAbsorb} de dano!`);
        const newHp = Math.max(0, p.hp - hpDamage);
        if (newHp <= 0) {
          setTimeout(() => {
            setGamePhase('defeat');
            addLog('Você foi derrotada...');
          }, DEFEAT_RESULT_DELAY_MS);
        } else {
          addLog(`${enemy.name} causou ${hpDamage} de dano!`);
          setTimeout(() => {
            setTurn(t => t + 1);
            setTimeRemaining(45);
            setGamePhase('drawing');
            setEnemyCastPlan(null);
            setCurrentComponents([]);
            setCurrentPrecision(null);
            setCurrentStrokes([]);
            setDetectedRuneIds([]);
            setDetectedFormula('');
            setPlayer(current => regenerateInk(current));
            setEnemy(current => regenerateInk(current));
            drawingInkSpentRef.current = 0;
            setDrawingInkSpent(0);
            resetCanvas();
          }, ENEMY_RESULT_DELAY_MS);
        }
        return { ...p, hp: newHp, shield: Math.max(0, p.shield - shieldAbsorb) };
      });
    }, ENEMY_CAST_START_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [gamePhase, enemy, player, turn, addLog, resetCanvas]);

  const nextRound = useCallback(() => {
    const newRound = round + 1;
    setRound(newRound);
    setEnemy(generateEnemy(newRound));
    setGamePhase('drawing');
    setEnemyCastPlan(null);
    drawingInkSpentRef.current = 0;
    setDrawingInkSpent(0);
    setCurrentComponents([]);
    setCurrentPrecision(null);
    setCurrentStrokes([]);
    setDetectedRuneIds([]);
    setDetectedFormula('');
    setCastResult(null);
    appliedCastRef.current = null;
    setTimeRemaining(45);
    resetCanvas();
    addLog(`Rodada ${newRound} começou!`);
  }, [round, addLog, resetCanvas]);

  return (
    <div className="min-h-screen bg-[#0a0508] text-amber-100 overflow-x-hidden">
      {/* Background ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(30,15,20,1)_0%,_rgba(5,2,5,1)_70%)]" />
        <div className="absolute inset-0 opacity-25 bg-[linear-gradient(90deg,_rgba(255,214,122,0.08)_1px,_transparent_1px),linear-gradient(180deg,_rgba(255,214,122,0.05)_1px,_transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full flex-col p-4">
        {/* Header */}
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-900/40 border border-amber-700/50 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-amber-200 leading-tight">Circulo Magico</h1>
              <p className="text-[10px] text-amber-600">SpellGraph + Codex</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(true)}
              className="p-2.5 rounded-xl bg-amber-900/30 border border-amber-800/40 hover:bg-amber-800/40 hover:border-amber-700/60 transition-all"
              title="Guia"
            >
              <HelpCircle className="w-4 h-4 text-amber-500" />
            </button>
            <button
              onClick={() => setShowCodex(true)}
              className="p-2.5 rounded-xl bg-amber-900/30 border border-amber-800/40 hover:bg-amber-800/40 hover:border-amber-700/60 transition-all"
              title="Codex"
            >
              <BookOpen className="w-4 h-4 text-amber-500" />
            </button>
          </div>
        </header>

        {/* Main Menu */}
        {gamePhase === 'menu' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-amber-900/30 border-2 border-amber-600/40 flex items-center justify-center animate-pulse">
                <Sparkles className="w-14 h-14 text-amber-400" />
              </div>
              <div className="absolute -inset-4 rounded-full border border-amber-700/20 animate-ping" style={{ animationDuration: '3s' }} />
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-amber-200">Mandala de Catalogo</h2>
              <p className="text-sm text-amber-400/70 max-w-xs mx-auto">
                Desenhe uma moldura e glifos conhecidos. O backend compila a mandala,
                aplica defaults seguros e registra formulas aceitas no Codex.
              </p>
            </div>

            <button
              onClick={startGame}
              className="group flex items-center gap-3 px-8 py-4 bg-amber-800/50 border-2 border-amber-600/60 rounded-2xl hover:bg-amber-700/60 hover:border-amber-500/80 transition-all hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-5 h-5 text-amber-400 group-hover:text-amber-300" />
              <span className="font-bold text-amber-200">Iniciar Batalha</span>
              <ChevronRight className="w-5 h-5 text-amber-500 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
              <div className="text-center p-3 bg-amber-950/30 border border-amber-900/30 rounded-lg">
                <Hexagon className="w-5 h-5 text-sky-400 mx-auto mb-1" />
                <p className="text-[10px] text-amber-500">Glifos</p>
                <p className="text-sm font-bold text-amber-200">{defaultGrimoireLoadout.knownGlyphIds.length}</p>
              </div>
              <div className="text-center p-3 bg-amber-950/30 border border-amber-900/30 rounded-lg">
                <Key className="w-5 h-5 text-pink-400 mx-auto mb-1" />
                <p className="text-[10px] text-amber-500">Defaults</p>
                <p className="text-sm font-bold text-amber-200">{menuDefaultRuneEntries.length}</p>
              </div>
              <div className="text-center p-3 bg-amber-950/30 border border-amber-900/30 rounded-lg">
                <Shield className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-[10px] text-amber-500">Risco</p>
                <p className="text-sm font-bold text-amber-200">{riskLabels[defaultGrimoireLoadout.maxRiskLevel]}</p>
              </div>
            </div>

            {/* Catalog hints from active backend ontology */}
            <div className="grid grid-cols-5 gap-2 max-w-sm mt-2">
              {menuRuneEntries.map(entry => (
                <div key={entry.templateId} className="text-center p-2 bg-amber-950/30 border border-amber-900/30 rounded-lg">
                  <div className="flex justify-center mb-1">
                    <MenuGlyphPreview templateId={entry.templateId} legacySigil={entry.legacySigil} />
                  </div>
                  <p className="text-[9px] text-amber-400/70 leading-tight">{entry.name}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-xs">
              <div className="text-center p-3 bg-amber-950/30 border border-amber-900/30 rounded-lg">
                <Hexagon className="w-6 h-6 text-sky-400 mx-auto mb-1" />
                <p className="text-[10px] text-amber-400/70">{roleLabels.element}</p>
              </div>
              <div className="text-center p-3 bg-amber-950/30 border border-amber-900/30 rounded-lg">
                <Key className="w-6 h-6 text-pink-400 mx-auto mb-1" />
                <p className="text-[10px] text-amber-400/70">{roleLabels.action}</p>
              </div>
              <div className="text-center p-3 bg-amber-950/30 border border-amber-900/30 rounded-lg">
                <Circle className="w-6 h-6 text-amber-400 mx-auto mb-1" />
                <p className="text-[10px] text-amber-400/70">{roleLabels.container}</p>
              </div>
            </div>
          </div>
        )}

        {/* Game Screen */}
        {gamePhase !== 'menu' && (
          <BattleSceneShell
            phase={gamePhase}
            round={round}
            turn={turn}
            combo={combo}
            score={score}
            timeRemaining={timeRemaining}
            player={player}
            enemy={enemy}
            enemyAction={enemyAction}
            enemyCastPlan={enemyCastPlan}
            drawingInkSpent={drawingInkSpent}
            detectedFormula={detectedFormula}
            detectedRuneIds={detectedRuneIds}
            currentPrecision={currentPrecision}
            castResult={castResult}
            logMessages={logMessages}
            canvasSlot={(
              <GameCanvas
                onGlyphComplete={handleGlyphComplete}
                isDrawingEnabled={gamePhase === 'drawing'}
                glowColor={canvasGlowColor}
                elementName={canvasElementName}
                inkAvailable={player.ink}
                onInkDrag={handleInkDrag}
              />
            )}
          />
        )}

        {/* Spell Effect - toast notification (does NOT block canvas) */}
        <SpellEffectDisplay
          result={castResult}
          onComplete={() => {}}
        />
      </div>

      {/* Victory Screen */}
      {gamePhase === 'victory' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-emerald-950/90 border-2 border-emerald-600/50 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-emerald-300 mb-2">Vitória!</h2>
            <p className="text-sm text-emerald-400/70 mb-4">
              Você derrotou {enemy.name}!
            </p>
            <div className="flex justify-center gap-6 mb-6">
              <div>
                <p className="text-2xl font-bold text-amber-300">{Math.round(score)}</p>
                <p className="text-xs text-amber-500">pontos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-300">{combo}x</p>
                <p className="text-xs text-emerald-500">combo máx</p>
              </div>
            </div>
            <button
              onClick={nextRound}
              className="w-full py-3 bg-emerald-800/50 border-2 border-emerald-600/60 rounded-xl font-bold text-emerald-200 hover:bg-emerald-700/60 hover:scale-105 transition-all"
            >
              Próxima Rodada →
            </button>
          </div>
        </div>
      )}

      {/* Defeat Screen */}
      {gamePhase === 'defeat' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-red-950/90 border-2 border-red-700/50 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <Skull className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-300 mb-2">Derrota</h2>
            <p className="text-sm text-red-400/70 mb-4">
              Sua magia não foi suficiente desta vez...
            </p>
            <div className="flex justify-center gap-6 mb-6">
              <div>
                <p className="text-2xl font-bold text-amber-300">{Math.round(score)}</p>
                <p className="text-xs text-amber-500">pontos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-300">{round}</p>
                <p className="text-xs text-red-500">rodadas</p>
              </div>
            </div>
            <button
              onClick={startGame}
              className="w-full py-3 bg-red-800/50 border-2 border-red-600/60 rounded-xl font-bold text-red-200 hover:bg-red-700/60 hover:scale-105 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* Overlays */}
      {showCodex && (
        <CodexPanel
          entries={codexEntries}
          loadout={defaultGrimoireLoadout}
          onClose={() => setShowCodex(false)}
        />
      )}
      {showGuide && <GuidePanel onClose={() => setShowGuide(false)} />}
    </div>
  );
}
