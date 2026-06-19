import { useState, useCallback, useEffect, useRef } from 'react';
import type { BattlefieldEffect, DrawingStroke, PrecisionBreakdown, GamePhase, Entity, StatusEffect } from '@/types/magic';
import type { ElementSigilId } from '@/types/magicFormulaV2';
import { generateEnemy } from '@/lib/spellEngine';
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
import {
  calculateFinalCastPrecision,
  resolveSpellCardCast,
} from '@/lib/spell/combatResolver';
import { type EnemySpellPlan } from '@/lib/spell/enemySpellAI';
import {
  dispelStatuses,
  mergeStatusEffects,
  tickBattlefieldEffects,
  tickEntityStatuses,
} from '@/lib/spell/combatEntityUtils';
import { resolveEnemyTurn } from '@/lib/spell/enemyTurnResolver';
import {
  defaultGrimoireLoadout,
  getAllowedGlyphIds,
  loadCodexEntries,
  recordSpellCardDiscovery,
  saveCodexEntries,
  validateSpellCardForLoadout,
} from '@/lib/spell/codexStore';
import type { RecognitionContext } from '@/lib/recognizerV2/recognitionContext';
import { resolveDiegeticFailure } from '@/lib/recognizer/failureResolver';
import { activeRuneDefinitions } from '@/data/magicOntology';
import { magicCatalogV2 } from '@/data/magicCatalogV2';
import { getGlyphById } from '@/data/glyphTemplates';
import { compileSpellFromStrokes } from '@/lib/spell/spellCompiler';
import { drawingStrokesToRecognitionStrokes } from '@/lib/spell/strokeAdapter';

import { riskLabels } from '@/lib/ui/runeCatalogPresentation';
import { workshopBackground } from '@/lib/ui/themeTokens';
import { GameCanvas } from '@/components/GameCanvas';
import { SpellEffectDisplay } from '@/components/SpellEffect';
import { CodexBook, type CodexBookTab } from '@/components/CodexBook';
import { BattleSceneShell } from '@/components/BattleSceneShell';
import {
  BookOpen,
  Trophy, Skull, RotateCcw, Sparkles, ChevronRight,
  GitBranch,
  Hexagon, Key, Shield
} from 'lucide-react';
import './App.css';
import type { DiegeticFailureResolution } from '@/lib/recognizer/failureResolver';
import type { GlyphTemplate } from '@/types/glyphTemplates';
import type { RecognitionTelemetryEvent } from '@/types/telemetry';
import type { SpellCard } from '@/types/spellCard';

const elementColors: Record<ElementSigilId, string> = {
  IGNIS: 'rgb(232, 93, 62)',
  AQUA: 'rgb(59, 141, 212)',
  TERRA: 'rgb(139, 111, 71)',
  VENTUS: 'rgb(126, 200, 160)',
  LUX: 'rgb(240, 208, 96)',
  UMBRA: 'rgb(155, 107, 204)',
  VITA: 'rgb(68, 204, 102)',
  GELU: 'rgb(136, 212, 238)',
  FULMEN: 'rgb(224, 208, 32)',
  SANGUIS: 'rgb(182, 66, 85)',
  MENS: 'rgb(183, 137, 214)',
};

const elementLabels: Record<ElementSigilId, string> = {
  IGNIS: 'Ignis',
  AQUA: 'Aqua',
  TERRA: 'Terra',
  VENTUS: 'Ventus',
  LUX: 'Lux',
  UMBRA: 'Umbra',
  VITA: 'Vita',
  GELU: 'Gelu',
  FULMEN: 'Fulmen',
  SANGUIS: 'Sanguis',
  MENS: 'Mens',
};

const knownMenuRuneEntries = activeRuneDefinitions.filter((entry) =>
  defaultGrimoireLoadout.knownGlyphIds.includes(entry.templateId),
);

const menuRuneEntries = knownMenuRuneEntries
  .filter((entry) => entry.binding.type === 'sigil')
  .slice(0, 10);

const knownMenuSigilCount = new Set(
  knownMenuRuneEntries.flatMap((entry) => entry.binding.type === 'sigil' ? [entry.binding.sigilId] : []),
).size;

const knownMenuKeyCount = new Set(
  knownMenuRuneEntries.flatMap((entry) => entry.binding.type === 'key' ? [entry.binding.keyId] : []),
).size;

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

function MenuGlyphPreview({ templateId }: { readonly templateId: string }) {
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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="text-[#1a4a6b] overflow-visible">
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
const DEFAULT_CANVAS_GLOW_COLOR = 'rgb(45, 106, 143)';
const DEFAULT_CANVAS_ELEMENT_NAME = '';

type GameplayCastResult = CastResult & {
  spellCard?: SpellCard;
  spellHash?: string;
  componentTemplateIds?: readonly string[];
  diegeticFailure?: DiegeticFailureResolution;
  telemetry?: RecognitionTelemetryEvent;
  inkFailure?: string;
  inkCostBreakdown?: ReturnType<typeof calculateSpellCardInkCost>;
};

const statusEffectLabel = (status: StatusEffect): string =>
  `${status.type} ${status.duration}t`;

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
  statusEffects: [],
  shieldBypassRatio: 0,
  dispelPower: 0,
  accuracy: 0,
  precision,
  isSuccess: false,
  feedback,
  elementalMultiplier: 0,
  inkCost: 0,
  ...extra,
});

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
    weakness: 'LUX',
    resistance: 'TERRA',
    status: [],
    isPlayer: false,
  });
  const [turn, setTurn] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(45);
  const [currentPrecision, setCurrentPrecision] = useState<PrecisionBreakdown | null>(null);
  const [currentStrokes, setCurrentStrokes] = useState<DrawingStroke[]>([]);
  const [castResult, setCastResult] = useState<GameplayCastResult | null>(null);
  const [codexEntries, setCodexEntries] = useState(loadCodexEntries);
  const [showCodexBook, setShowCodexBook] = useState(false);
  const [codexBookTab, setCodexBookTab] = useState<CodexBookTab>('learn');
  const [tutorialMode, setTutorialMode] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(1);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [enemyAction, setEnemyAction] = useState<string>('');
  const [enemyCastPlan, setEnemyCastPlan] = useState<EnemySpellPlan | null>(null);
  const [drawingInkSpent, setDrawingInkSpent] = useState(0);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [battlefieldEffects, setBattlefieldEffects] = useState<BattlefieldEffect[]>([]);
  const [detectedRuneIds, setDetectedRuneIds] = useState<string[]>([]);
  const [detectedFormula, setDetectedFormula] = useState('');
  const [canvasGlowColor, setCanvasGlowColor] = useState(DEFAULT_CANVAS_GLOW_COLOR);
  const [canvasElementName, setCanvasElementName] = useState(DEFAULT_CANVAS_ELEMENT_NAME);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasResetRef = useRef(false);
  const appliedCastRef = useRef<GameplayCastResult | null>(null);
  const drawingInkSpentRef = useRef(0);
  const playerInkRef = useRef(player.ink);
  const enemyTurnResolvedRef = useRef<number | null>(null);
  const castPhaseTokenRef = useRef(0);
  const enemyTurnTokenRef = useRef(0);
  const pendingEnemyTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const preserveFailedDrawingRef = useRef(false);
  const firstFormulaTutorialShownRef = useRef(false);
  const castRequestRef = useRef(0);
  const isCombatPaused = showCodexBook || tutorialMode;
  const playerRef = useRef(player);
  const enemyRef = useRef(enemy);
  const battlefieldEffectsRef = useRef(battlefieldEffects);

  const addLog = useCallback((msg: string) => {
    setLogMessages(prev => [msg, ...prev].slice(0, 20));
  }, []);

  const clearPendingEnemyTimeouts = useCallback(() => {
    pendingEnemyTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    pendingEnemyTimeoutsRef.current = [];
  }, []);

  const scheduleEnemyTimeout = useCallback((callback: () => void, delayMs: number) => {
    const timeoutId = setTimeout(() => {
      pendingEnemyTimeoutsRef.current = pendingEnemyTimeoutsRef.current.filter((id) => id !== timeoutId);
      callback();
    }, delayMs);
    pendingEnemyTimeoutsRef.current.push(timeoutId);
  }, []);

  useEffect(() => {
    saveCodexEntries(codexEntries);
  }, [codexEntries]);

  const resetCanvas = useCallback(() => {
    if ((window as unknown as Record<string, unknown>).__resetCanvas) {
      ((window as unknown as Record<string, unknown>).__resetCanvas as () => void)();
    }
    canvasResetRef.current = true;
    setCanvasGlowColor(DEFAULT_CANVAS_GLOW_COLOR);
    setCanvasElementName(DEFAULT_CANVAS_ELEMENT_NAME);
  }, []);

  const finalizeCanvas = useCallback(() => {
    const finalize = (window as unknown as Record<string, unknown>).__finalizeCanvas as (() => boolean) | undefined;
    return finalize ? finalize() : false;
  }, []);

  useEffect(() => {
    playerInkRef.current = player.ink;
  }, [player.ink]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    enemyRef.current = enemy;
  }, [enemy]);

  useEffect(() => {
    battlefieldEffectsRef.current = battlefieldEffects;
  }, [battlefieldEffects]);

  const startGame = useCallback(() => {
    castRequestRef.current += 1;
    castPhaseTokenRef.current += 1;
    enemyTurnTokenRef.current += 1;
    clearPendingEnemyTimeouts();
    setGamePhase('drawing');
    setPlayer(p => ({ ...p, hp: p.maxHp, shield: 0, ink: p.maxInk }));
    setEnemy(generateEnemy(1));
    setTurn(1);
    setCombo(0);
    setScore(0);
    setRound(1);
    setEnemyCastPlan(null);
    drawingInkSpentRef.current = 0;
    enemyTurnResolvedRef.current = null;
    preserveFailedDrawingRef.current = false;
    setDrawingInkSpent(0);
    setTimeRemaining(45);
    setCurrentPrecision(null);
    setCurrentStrokes([]);
    setCastResult(null);
    appliedCastRef.current = null;
    setBattlefieldEffects([]);
    setLogMessages([]);
    setDetectedRuneIds([]);
    setDetectedFormula('');
    setTutorialMode(false);
    resetCanvas();
    addLog('A batalha começou! Desenhe seu primeiro glifo.');
    if (!firstFormulaTutorialShownRef.current) {
      firstFormulaTutorialShownRef.current = true;
      setTutorialMode(true);
      setTutorialStep(1);
      setCodexBookTab('learn');
      setShowCodexBook(true);
    }
  }, [addLog, resetCanvas, clearPendingEnemyTimeouts]);

  const evaluateCurrentGlyph = useCallback(async (
    precisionOverride: PrecisionBreakdown | null = currentPrecision,
    strokesOverride: DrawingStroke[] = currentStrokes,
  ) => {
    const precision = precisionOverride?.overall || 50;
    if (strokesOverride.length === 0) {
      setCastResult(makeFailureResult(
        'Falha Magica',
        'Nenhum glifo foi desenhado.',
        'O tempo acabou antes que voce pudesse desenhar.',
        0,
      ));
      setGamePhase('casting');
      return;
    }

    const requestId = ++castRequestRef.current;
    setGamePhase('evaluating');
    const recognitionStrokes = drawingStrokesToRecognitionStrokes(strokesOverride);
    const recognitionContext: RecognitionContext = {
      allowedTemplateIds: getAllowedGlyphIds(defaultGrimoireLoadout, codexEntries),
      enemyWeakness: enemy.weakness,
    };
    const compiled = await compileSpellFromStrokes(recognitionStrokes, { recognitionContext });
    if (requestId !== castRequestRef.current) return;
    const telemetry = compiled.telemetry;

    if (!compiled.ok) {
      const failure = compiled.failure;
      setCastResult(makeFailureResult(
        'Mandala Incompleta',
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
    setDetectedFormula(card.formula.name);
    const primaryElement = card.formula.sigils[0];
    if (card.effectProfile.element) {
      setCanvasGlowColor(elementColors[card.effectProfile.element]);
      setCanvasElementName(primaryElement ? elementLabels[primaryElement.sigilId] : elementLabels[card.effectProfile.element]);
    } else if (primaryElement) {
      setCanvasGlowColor(elementColors[primaryElement.sigilId]);
      setCanvasElementName(elementLabels[primaryElement.sigilId]);
    } else {
      setCanvasGlowColor(DEFAULT_CANVAS_GLOW_COLOR);
      setCanvasElementName(DEFAULT_CANVAS_ELEMENT_NAME);
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
      const inkFeedback = `Sua formula precisa de ${inkSimulation.cost} de tinta, mas voce tem ${casterBeforeDrawing.ink}. Simplifique a mandala ou espere a tinta se recuperar.`;
      setCastResult(makeFailureResult(
        'Tinta Insuficiente',
        inkFeedback,
        inkFeedback,
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

    const finalPrecision = calculateFinalCastPrecision(card, precision);
    setCastResult({
      ...resolveSpellCardCast({
        card,
        precision: finalPrecision,
        opponent: enemy,
        inkCost: inkSimulation.cost,
        inkRemaining: inkSimulation.remainingInk,
        inkOverloadChance: inkSimulation.overloadChance,
        inkCostBreakdown: inkBreakdown,
      }),
      telemetry,
    });
    setGamePhase('casting');
    return;
  }, [currentPrecision, currentStrokes, codexEntries, enemy, player]);

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

  const handleInkRefund = useCallback((distance: number) => {
    const requestedRefund = distance * INK_PER_DRAW_PIXEL;
    const refunded = Math.min(drawingInkSpentRef.current, requestedRefund);
    if (refunded <= 0) return;

    drawingInkSpentRef.current = Number(Math.max(0, drawingInkSpentRef.current - refunded).toFixed(2));
    setDrawingInkSpent(drawingInkSpentRef.current);
    setPlayer(current => {
      const nextInk = Number(Math.min(current.maxInk, current.ink + refunded).toFixed(2));
      playerInkRef.current = nextInk;
      return { ...current, ink: nextInk };
    });
  }, []);

  // Timer
  useEffect(() => {
    if (gamePhase !== 'drawing' || isCombatPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (!finalizeCanvas()) void evaluateCurrentGlyph();
          return 45;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gamePhase, isCombatPaused, evaluateCurrentGlyph, finalizeCanvas]);

  const handleGlyphComplete = useCallback((precision: PrecisionBreakdown, strokes: DrawingStroke[]) => {
    setTutorialMode(false);
    setCurrentPrecision(precision);
    setCurrentStrokes(strokes);

    setCanvasGlowColor(DEFAULT_CANVAS_GLOW_COLOR);
    setCanvasElementName(DEFAULT_CANVAS_ELEMENT_NAME);

    setTimeout(() => {
      void evaluateCurrentGlyph(precision, strokes);
    }, turnPresentationTimings.glyphReadDelay);
  }, [evaluateCurrentGlyph]);

  // Apply cast result
  useEffect(() => {
    if (gamePhase !== 'casting' || !castResult || isCombatPaused) return;
    if (appliedCastRef.current === castResult) return;
    preserveFailedDrawingRef.current = !castResult.isSuccess && currentStrokes.length > 0;
    const castToken = ++castPhaseTokenRef.current;

    const timeout = setTimeout(() => {
      if (castToken !== castPhaseTokenRef.current) return;
      if (appliedCastRef.current === castResult) return;
      appliedCastRef.current = castResult;
      const remainingInkCost = Math.max(0, castResult.inkCost - drawingInkSpentRef.current);
      const enemySnapshot = enemyRef.current;

      if (remainingInkCost > 0) {
        setPlayer(p => spendInk(p, remainingInkCost));
      }

      let enemyWasDefeated = false;
      if (castResult.isSuccess) {
        const actualDamage = castResult.damage;
        const affectsCaster = castResult.effects.some((effect) => effect.area === "self");
        const shieldBypass = Math.round(actualDamage * castResult.shieldBypassRatio);
        const shieldableDamage = Math.max(0, actualDamage - shieldBypass);
        const shieldAbsorb = Math.min(shieldableDamage, enemySnapshot.shield);
        const hpDamage = shieldBypass + shieldableDamage - shieldAbsorb;
        enemyWasDefeated = enemySnapshot.hp - hpDamage <= 0;

        setEnemy(e => {
          const afterShield = Math.max(0, e.shield - shieldAbsorb);
          const dispelledShield = affectsCaster ? afterShield : Math.max(0, afterShield - castResult.dispelPower);
          return {
            ...e,
            hp: Math.max(0, e.hp - hpDamage),
            shield: dispelledShield,
            status: affectsCaster
              ? e.status
              : mergeStatusEffects(dispelStatuses(e.status, castResult.dispelPower), castResult.statusEffects),
          };
        });

        if (castResult.healing > 0) {
          setPlayer(p => ({ ...p, hp: Math.min(p.maxHp, p.hp + castResult.healing) }));
        }
        if (castResult.shield > 0) {
          setPlayer(p => ({ ...p, shield: p.shield + castResult.shield }));
        }
        if (affectsCaster && (castResult.statusEffects.length > 0 || castResult.dispelPower > 0)) {
          setPlayer(p => ({
            ...p,
            status: mergeStatusEffects(dispelStatuses(p.status, castResult.dispelPower), castResult.statusEffects),
          }));
        }
        if (castResult.fieldEffect) {
          setBattlefieldEffects(effects => [
            castResult.fieldEffect!,
            ...effects.filter((effect) => effect.id !== castResult.fieldEffect!.id),
          ].slice(0, 4));
        }

        setCombo(prevCombo => {
          setScore(scorePrev => scorePrev + actualDamage * (1 + prevCombo * 0.1));
          return prevCombo + 1;
        });

        if (castResult.spellCard) {
          setCodexEntries(entries => recordSpellCardDiscovery(entries, castResult.spellCard!));
          addLog(`Codex registrou ${castResult.spellCard.name} (${castResult.spellHash}).`);
        }

        if (castResult.statusEffects.length > 0) {
          addLog(`Efeitos ativos: ${castResult.statusEffects.map(statusEffectLabel).join(', ')}.`);
        }
        if (castResult.fieldEffect) {
          addLog(`Campo ${castResult.fieldEffect.type} estabilizado por ${castResult.fieldEffect.duration} turnos.`);
        }


        addLog(`Você lançou ${castResult.spellName} causando ${hpDamage} de dano. Tinta: -${castResult.inkCost}.`);
      } else {
        setCombo(0);
        addLog(`Sua magia falhou: ${castResult.feedback}`);
      }

      const phaseAdvanceToken = castToken;
      setTimeout(() => {
        if (phaseAdvanceToken !== castPhaseTokenRef.current) return;
        if (enemyWasDefeated) {
          addLog(`Você derrotou ${enemyRef.current.name}!`);
          setGamePhase('victory');
        } else {
          enemyTurnResolvedRef.current = null;
          enemyTurnTokenRef.current += 1;
          setGamePhase('enemy_turn');
        }
      }, PLAYER_CAST_PHASE_ADVANCE_DELAY_MS);
    }, PLAYER_CAST_RESULT_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [gamePhase, castResult, currentStrokes.length, isCombatPaused, addLog]);

  const advanceToNextDrawingTurn = useCallback(() => {
    castPhaseTokenRef.current += 1;
    enemyTurnTokenRef.current += 1;
    clearPendingEnemyTimeouts();
    enemyTurnResolvedRef.current = null;
    setTurn(t => t + 1);
    setTimeRemaining(45);
    setGamePhase('drawing');
    setEnemyCastPlan(null);
    setCurrentPrecision(null);
    setCurrentStrokes([]);
    setDetectedRuneIds([]);
    setDetectedFormula('');
    setCastResult(null);
    appliedCastRef.current = null;
    setPlayer(current => regenerateInk(tickEntityStatuses(current)));
    setEnemy(current => regenerateInk(tickEntityStatuses(current)));
    setBattlefieldEffects(effects => tickBattlefieldEffects(effects));
    drawingInkSpentRef.current = 0;
    setDrawingInkSpent(0);
    if (preserveFailedDrawingRef.current) {
      preserveFailedDrawingRef.current = false;
    } else {
      resetCanvas();
    }
  }, [resetCanvas, clearPendingEnemyTimeouts]);

  // Enemy turn
  useEffect(() => {
    if (
      gamePhase !== 'enemy_turn' ||
      isCombatPaused ||
      enemyTurnResolvedRef.current === turn
    ) return;

    const enemyTurnToken = enemyTurnTokenRef.current;
    const timeout = setTimeout(() => {
      if (enemyTurnToken !== enemyTurnTokenRef.current) return;
      if (enemyTurnResolvedRef.current === turn) return;
      enemyTurnResolvedRef.current = turn;

      const resolution = resolveEnemyTurn({
        enemy: enemyRef.current,
        player: playerRef.current,
        battlefieldEffects: battlefieldEffectsRef.current,
        turn,
      });

      if (resolution.plan) {
        setEnemyCastPlan(resolution.plan);
        setEnemyAction(resolution.plan.effectText);
      }
      resolution.logs.forEach((message) => addLog(message));
      setEnemy(resolution.enemy);
      setPlayer(resolution.player);
      setBattlefieldEffects([...resolution.battlefieldEffects]);

      if (resolution.outcome === 'defeat') {
        scheduleEnemyTimeout(() => {
          if (enemyTurnToken !== enemyTurnTokenRef.current) return;
          setGamePhase('defeat');
        }, DEFEAT_RESULT_DELAY_MS);
        return;
      }

      scheduleEnemyTimeout(() => {
        if (enemyTurnToken !== enemyTurnTokenRef.current) return;
        advanceToNextDrawingTurn();
      }, ENEMY_RESULT_DELAY_MS);
    }, ENEMY_CAST_START_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [
    gamePhase,
    isCombatPaused,
    turn,
    addLog,
    advanceToNextDrawingTurn,
    scheduleEnemyTimeout,
  ]);

  const nextRound = useCallback(() => {
    const newRound = round + 1;
    setRound(newRound);
    setEnemy(generateEnemy(newRound));
    setGamePhase('drawing');
    setEnemyCastPlan(null);
    drawingInkSpentRef.current = 0;
    setDrawingInkSpent(0);
    setCurrentPrecision(null);
    setCurrentStrokes([]);
    setDetectedRuneIds([]);
    setDetectedFormula('');
    setCastResult(null);
    appliedCastRef.current = null;
    setBattlefieldEffects([]);
    setTimeRemaining(45);
    resetCanvas();
    addLog(`Rodada ${newRound} começou!`);
  }, [round, addLog, resetCanvas]);

  return (
    <div className="min-h-screen text-[#e8d4a8] overflow-x-hidden" style={{ background: '#0d0608' }}>
      <div className="wha-scene" aria-hidden="true">
        <div className="wha-scene-bg" style={{ backgroundImage: workshopBackground }} />
        <div className="wha-scene-vignette" />
        <div className="wha-scene-candles" />
        <div className="wha-scene-grain" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full flex-col p-4">
        <header className="wha-header">
          <div className="wha-header-brand">
            <img src="/assets/witch-hat-emblem.jpg" alt="" className="wha-header-icon" />
            <div>
              <h1 className="font-display text-base font-bold text-[#e8c86a] leading-tight tracking-wider">Círculo Mágico</h1>
              <p className="text-[10px] text-[#c9a227]/70 tracking-[0.2em] uppercase">Grimório v2.2</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCodexBookTab('learn');
                setShowCodexBook(true);
              }}
              className="wha-icon-btn"
              title="Grimório"
            >
              <BookOpen className="w-4 h-4 text-[#c9a227]" />
            </button>
          </div>
        </header>

        {/* Main Menu */}
        {gamePhase === 'menu' && (
          <div className="wha-menu animate-panel-rise">
            <div className="wha-menu-hero">
              <div className="wha-emblem-ring animate-float">
                <img src="/assets/witch-hat-emblem.jpg" alt="" className="wha-emblem" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="wha-title">Mandala v2.2</h2>
                <p className="wha-subtitle">
                  Trace o círculo externo, um sigilo central, chaves e canais.
                  Cada traço de tinta cobalto define o destino da sua magia.
                </p>
              </div>
            </div>

            <button onClick={startGame} className="wha-cta group">
              <Sparkles className="w-5 h-5 text-[#e8c86a] relative z-10" />
              <span className="relative z-10">Iniciar Batalha</span>
              <ChevronRight className="w-5 h-5 text-[#c9a227] group-hover:translate-x-1 transition-transform relative z-10" />
            </button>

            <div className="wha-stat-grid">
              <div className="wha-stat-card">
                <Hexagon className="w-5 h-5 text-[#2d6a8f] mx-auto mb-1" />
                <p className="text-[10px] text-[#c9a227]/70 uppercase tracking-wider">Sigilos</p>
                <p className="text-sm font-bold text-[#e8d4a8] font-mono">{knownMenuSigilCount}/{magicCatalogV2.sigils.length}</p>
              </div>
              <div className="wha-stat-card">
                <Key className="w-5 h-5 text-[#b789d6] mx-auto mb-1" />
                <p className="text-[10px] text-[#c9a227]/70 uppercase tracking-wider">Chaves</p>
                <p className="text-sm font-bold text-[#e8d4a8] font-mono">{knownMenuKeyCount}/{magicCatalogV2.keys.length}</p>
              </div>
              <div className="wha-stat-card">
                <Shield className="w-5 h-5 text-[#3d8b5a] mx-auto mb-1" />
                <p className="text-[10px] text-[#c9a227]/70 uppercase tracking-wider">Risco</p>
                <p className="text-sm font-bold text-[#e8d4a8]">{riskLabels[defaultGrimoireLoadout.maxRiskLevel]}</p>
              </div>
            </div>

            <div className="wha-rune-grid">
              {menuRuneEntries.map(entry => (
                <div key={entry.templateId} className="wha-rune-tile">
                  <div className="flex justify-center mb-1">
                    <MenuGlyphPreview templateId={entry.templateId} />
                  </div>
                  <p className="text-[9px] text-[#c9a227]/65 leading-tight">{entry.name}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 text-[10px] text-[#c9a227]/50 uppercase tracking-[0.2em]">
              <span className="inline-flex items-center gap-1"><Hexagon className="w-3.5 h-3.5" /> Sigilos</span>
              <span className="inline-flex items-center gap-1"><Key className="w-3.5 h-3.5" /> Chaves</span>
              <span className="inline-flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" /> Canais</span>
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
            battlefieldEffects={battlefieldEffects}
            logMessages={logMessages}
            canvasSlot={(
              <GameCanvas
                onGlyphComplete={handleGlyphComplete}
                isDrawingEnabled={gamePhase === 'drawing'}
                glowColor={canvasGlowColor}
                elementName={canvasElementName}
                inkAvailable={player.ink}
                onInkDrag={handleInkDrag}
                onInkRefund={handleInkRefund}
                tutorialMode={tutorialMode}
                tutorialStep={tutorialStep}
                onExitTutorial={() => setTutorialMode(false)}
              />
            )}
          />
        )}

        {/* Spell Effect - toast notification (does NOT block canvas) */}
      <SpellEffectDisplay
        result={castResult}
      />
      </div>

      {/* Victory Screen */}
      {gamePhase === 'victory' && (
        <div className="wha-modal-overlay">
          <div className="wha-modal-panel wha-modal-panel--victory">
            <Trophy className="w-16 h-16 text-[#e8c86a] mx-auto mb-4 animate-pulse-glow" />
            <h2 className="font-display text-2xl font-bold text-[#3d8b5a] mb-2 tracking-wider">Vitória</h2>
            <p className="text-sm text-[#e8d4a8]/70 mb-4 italic">
              O selo se fechou. Você derrotou {enemy.name}.
            </p>
            <div className="flex justify-center gap-6 mb-6">
              <div>
                <p className="text-2xl font-bold text-[#e8c86a] font-mono">{Math.round(score)}</p>
                <p className="text-xs text-[#c9a227]/60 uppercase tracking-wider">pontos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#3d8b5a] font-mono">{combo}x</p>
                <p className="text-xs text-[#c9a227]/60 uppercase tracking-wider">combo</p>
              </div>
            </div>
            <button onClick={nextRound} className="wha-cta w-full justify-center">
              Próxima Rodada →
            </button>
          </div>
        </div>
      )}

      {gamePhase === 'defeat' && (
        <div className="wha-modal-overlay">
          <div className="wha-modal-panel wha-modal-panel--defeat">
            <Skull className="w-16 h-16 text-[#8b2e3a] mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold text-[#8b2e3a] mb-2 tracking-wider">Derrota</h2>
            <p className="text-sm text-[#e8d4a8]/70 mb-4 italic">
              O círculo perdeu estabilidade. Sua magia não foi suficiente...
            </p>
            <div className="flex justify-center gap-6 mb-6">
              <div>
                <p className="text-2xl font-bold text-[#e8c86a] font-mono">{Math.round(score)}</p>
                <p className="text-xs text-[#c9a227]/60 uppercase tracking-wider">pontos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#8b2e3a] font-mono">{round}</p>
                <p className="text-xs text-[#c9a227]/60 uppercase tracking-wider">rodadas</p>
              </div>
            </div>
            <button onClick={startGame} className="wha-cta w-full justify-center">
              <RotateCcw className="w-4 h-4" />
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* Overlays */}
      {showCodexBook && (
        <CodexBook
          entries={codexEntries}
          loadout={defaultGrimoireLoadout}
          initialTab={codexBookTab}
          activeTutorialStep={tutorialStep}
          onClose={() => setShowCodexBook(false)}
          onTutorialStepChange={setTutorialStep}
          onStartTutorial={gamePhase === 'drawing'
            ? () => {
                setTutorialMode(true);
                setShowCodexBook(false);
              }
            : undefined}
        />
      )}
    </div>
  );
}
