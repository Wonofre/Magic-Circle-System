import { useState, useCallback, useEffect, useRef } from 'react';
import type { GlyphComponent, PrecisionBreakdown, GamePhase, Entity } from '@/types/magic';
import type { SigilType, SignType } from '@/types/magic';
import { SIGILS, SIGNS } from '@/lib/magicSystem';
import {
  buildProceduralSpell,
  castSpell,
  formatDiscoveryMessage,
  generateEnemy,
  getEnemyAction,
  PREDEFINED_SPELLS,
  spellMatchesPattern,
} from '@/lib/spellEngine';
import type { CastResult } from '@/lib/spellEngine';
import { GameCanvas } from '@/components/GameCanvas';
import { SpellEffectDisplay } from '@/components/SpellEffect';
import { PrecisionDetails } from '@/components/PrecisionDetails';
import { GrimoirePanel } from '@/components/GrimoirePanel';
import { GuidePanel } from '@/components/GuidePanel';
import { PerfectGlyphPreview } from '@/components/PerfectGlyphPreview';
import {
  Heart, Shield, Swords, BookOpen, HelpCircle, Timer,
  Trophy, Skull, RotateCcw, Sparkles, Zap, TrendingUp,
  Flame, Droplets, Mountain, Wind, Sun, ChevronRight,
  Snowflake, Moon, CloudLightning, Leaf, Circle,
  Hexagon, Key
} from 'lucide-react';
import './App.css';

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

const elementIcons: Record<SigilType, React.ReactNode> = {
  fire:    <Flame        className="w-4 h-4 text-orange-400" />,
  water:   <Droplets     className="w-4 h-4 text-blue-400" />,
  earth:   <Mountain     className="w-4 h-4 text-amber-600" />,
  wind:    <Wind         className="w-4 h-4 text-emerald-400" />,
  light:   <Sun          className="w-4 h-4 text-yellow-300" />,
  ice:     <Snowflake    className="w-4 h-4 text-cyan-300" />,
  shadow:  <Moon         className="w-4 h-4 text-purple-400" />,
  thunder: <CloudLightning className="w-4 h-4 text-yellow-400" />,
  nature:  <Leaf         className="w-4 h-4 text-green-400" />,
  void:    <Circle       className="w-4 h-4 text-violet-400" />,
};

export default function App() {
  const [gamePhase, setGamePhase] = useState<GamePhase>('menu');
  const [player, setPlayer] = useState<Entity>({
    id: 'player',
    name: 'Aprendiz de Bruxa',
    hp: 100,
    maxHp: 100,
    shield: 0,
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
  const [castResult, setCastResult] = useState<CastResult | null>(null);
  const [spells, setSpells] = useState([...PREDEFINED_SPELLS]);
  const [showGrimoire, setShowGrimoire] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [enemyAction, setEnemyAction] = useState<string>('');
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [detectedSigils, setDetectedSigils] = useState<SigilType[]>([]);
  const [detectedSigns, setDetectedSigns] = useState<SignType[]>([]);
  const [canvasGlowColor, setCanvasGlowColor] = useState('rgb(180, 140, 80)');
  const [canvasElementName, setCanvasElementName] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasResetRef = useRef(false);
  const appliedCastRef = useRef<CastResult | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogMessages(prev => [msg, ...prev].slice(0, 20));
  }, []);

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

  const startGame = useCallback(() => {
    setGamePhase('drawing');
    setPlayer(p => ({ ...p, hp: p.maxHp, shield: 0 }));
    setEnemy(generateEnemy(1));
    setTurn(1);
    setCombo(0);
    setScore(0);
    setRound(1);
    setTimeRemaining(45);
    setCurrentComponents([]);
    setCurrentPrecision(null);
    setCastResult(null);
    appliedCastRef.current = null;
    setLogMessages([]);
    setDetectedSigils([]);
    setDetectedSigns([]);
    resetCanvas();
    addLog('A batalha começou! Desenhe seu primeiro glifo.');
  }, [addLog, resetCanvas]);

  const evaluateCurrentGlyph = useCallback((
    componentsOverride: GlyphComponent[] = currentComponents,
    precisionOverride: PrecisionBreakdown | null = currentPrecision,
  ) => {
    if (componentsOverride.length === 0) {
      setCastResult({
        spellName: 'Falha Mágica',
        description: 'Nenhum glifo foi desenhado.',
        damage: 0, healing: 0, shield: 0,
        effects: [], accuracy: 0, precision: 0,
        isSuccess: false,
        feedback: 'O tempo acabou antes que você pudesse desenhar.',
        elementalMultiplier: 0,
      });
      setGamePhase('casting');
      return;
    }

    const ring = componentsOverride.find(c => c.type === 'ring') || null;
    if (!ring) {
      setCastResult({
        spellName: 'Glifo Incompleto',
        description: 'O círculo mágico não foi fechado.',
        damage: 0, healing: 0, shield: 0,
        effects: [], accuracy: 0,
        precision: precisionOverride?.overall || 0,
        isSuccess: false,
        feedback: 'A magia precisa de um anel fechado para ativar.',
        elementalMultiplier: 0,
      });
      setGamePhase('casting');
      return;
    }

    const sigils = componentsOverride
      .filter(c => c.type === 'sigil' && c.sigilType)
      .map(c => c.sigilType!);
    const signs = componentsOverride
      .filter(c => c.type === 'sign' && c.signType)
      .map(c => c.signType!);

    const precision = precisionOverride?.overall || 50;
    const result = castSpell(sigils, signs, precision, enemy);
    setCastResult(result);
    setGamePhase('casting');
  }, [currentComponents, currentPrecision, enemy]);

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

  const handleGlyphComplete = useCallback((components: GlyphComponent[], precision: PrecisionBreakdown) => {
    setCurrentComponents(components);
    setCurrentPrecision(precision);

    const sigils = components.filter(c => c.type === 'sigil').map(c => c.sigilType!).filter(Boolean);
    const signs = components.filter(c => c.type === 'sign').map(c => c.signType!).filter(Boolean);

    setDetectedSigils(sigils);
    setDetectedSigns(signs);

    if (sigils.length > 0) {
      setCanvasGlowColor(elementColors[sigils[0]]);
      setCanvasElementName(SIGILS[sigils[0]].namePt);
    }

    setTimeout(() => {
      evaluateCurrentGlyph(components, precision);
    }, 600);
  }, [evaluateCurrentGlyph]);

  // Apply cast result
  useEffect(() => {
    if (gamePhase !== 'casting' || !castResult) return;
    if (appliedCastRef.current === castResult) return;
    appliedCastRef.current = castResult;

    const timeout = setTimeout(() => {
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

        // Check for spell discovery
        const spellSigils = [...detectedSigils].sort();
        const spellSigns = [...detectedSigns].sort();
        setSpells(prev => {
          let spellWasKnown = false;
          const updated = prev.map(spell => {
          if (spellMatchesPattern(spell, spellSigils, spellSigns)) {
            spellWasKnown = true;
            if (!spell.discovered) addLog(`✨ Nova magia descoberta: ${spell.namePt}!`);
            return { ...spell, discovered: true, useCount: spell.useCount + 1 };
          }
          return spell;
        });

          if (!spellWasKnown && detectedSigils.length > 0) {
            const discoveredSpell = buildProceduralSpell(detectedSigils, detectedSigns, true, castResult.precision);
            addLog(formatDiscoveryMessage(discoveredSpell, castResult.precision));
            updated.unshift(discoveredSpell);
          }

          return updated;
        });

        addLog(`Você lançou ${castResult.spellName} causando ${actualDamage} de dano!`);
      } else {
        setCombo(0);
        addLog(`A magia falhou... ${castResult.feedback}`);
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
      }, 500);
    }, 2800);

    return () => clearTimeout(timeout);
  }, [gamePhase, castResult, enemy.hp, enemy.shield, combo, detectedSigils, detectedSigns, addLog]);

  // Enemy turn
  useEffect(() => {
    if (gamePhase !== 'enemy_turn') return;

    const timeout = setTimeout(() => {
      const action = getEnemyAction(enemy);
      setEnemyAction(action.effect || `${enemy.name} ataca!`);
      if (action.effect) addLog(action.effect);

      const damage = action.damage;

      setPlayer(p => {
        const shieldAbsorb = Math.min(damage, p.shield);
        const hpDamage = damage - shieldAbsorb;
        if (p.shield > 0) addLog(`Seu escudo absorveu ${shieldAbsorb} de dano!`);
        const newHp = Math.max(0, p.hp - hpDamage);
        if (newHp <= 0) {
          setTimeout(() => {
            setGamePhase('defeat');
            addLog('Você foi derrotada...');
          }, 1000);
        } else {
          addLog(`${enemy.name} causou ${hpDamage} de dano!`);
          setTimeout(() => {
            setTurn(t => t + 1);
            setTimeRemaining(45);
            setGamePhase('drawing');
            setCurrentComponents([]);
            setCurrentPrecision(null);
            setDetectedSigils([]);
            setDetectedSigns([]);
            resetCanvas();
          }, 1500);
        }
        return { ...p, hp: newHp, shield: Math.max(0, p.shield - shieldAbsorb) };
      });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [gamePhase, enemy, addLog, resetCanvas]);

  const nextRound = useCallback(() => {
    const newRound = round + 1;
    setRound(newRound);
    setEnemy(generateEnemy(newRound));
    setGamePhase('drawing');
    setCurrentComponents([]);
    setCurrentPrecision(null);
    setCastResult(null);
    appliedCastRef.current = null;
    setTimeRemaining(45);
    resetCanvas();
    addLog(`Rodada ${newRound} começou!`);
  }, [round, addLog, resetCanvas]);

  const getHpColor = (entity: Entity) => {
    const ratio = entity.hp / entity.maxHp;
    if (ratio > 0.6) return 'bg-emerald-500';
    if (ratio > 0.3) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-[#0a0508] text-amber-100 overflow-x-hidden">
      {/* Background ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(30,15,20,1)_0%,_rgba(5,2,5,1)_70%)]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-900/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-900/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto p-4 flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-900/40 border border-amber-700/50 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-amber-200 leading-tight">Círculo Mágico</h1>
              <p className="text-[10px] text-amber-600">Witch Hat Atelier</p>
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
              onClick={() => setShowGrimoire(true)}
              className="p-2.5 rounded-xl bg-amber-900/30 border border-amber-800/40 hover:bg-amber-800/40 hover:border-amber-700/60 transition-all"
              title="Grimório"
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
              <h2 className="text-2xl font-bold text-amber-200">Witch Hat Atelier</h2>
              <p className="text-sm text-amber-400/70 max-w-xs mx-auto">
                Aprenda a arte da magia através dos glifos.
                Desenhe sigilos, chaves e círculos para lançar feitiços.
              </p>
            </div>

            <button
              onClick={startGame}
              className="group flex items-center gap-3 px-8 py-4 bg-amber-800/50 border-2 border-amber-600/60 rounded-2xl hover:bg-amber-700/60 hover:border-amber-500/80 transition-all hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-5 h-5 text-amber-400 group-hover:text-amber-300" />
              <span className="font-bold text-amber-200">Iniciar Jornada</span>
              <ChevronRight className="w-5 h-5 text-amber-500 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Tutorial hints - show all 10 elements */}
            <div className="grid grid-cols-5 gap-2 max-w-sm mt-2">
              {(Object.keys(SIGILS) as SigilType[]).map(k => (
                <div key={k} className="text-center p-2 bg-amber-950/30 border border-amber-900/30 rounded-xl">
                  <div className="flex justify-center mb-1">
                    <PerfectGlyphPreview mode="sigil" type={k} size={34} strokeWidth={3} />
                  </div>
                  <p className="text-[9px] text-amber-400/70 leading-tight">{SIGILS[k].namePt}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-xs">
              <div className="text-center p-3 bg-amber-950/30 border border-amber-900/30 rounded-xl">
                <Hexagon className="w-6 h-6 text-sky-400 mx-auto mb-1" />
                <p className="text-[10px] text-amber-400/70">Sigilos</p>
              </div>
              <div className="text-center p-3 bg-amber-950/30 border border-amber-900/30 rounded-xl">
                <Key className="w-6 h-6 text-pink-400 mx-auto mb-1" />
                <p className="text-[10px] text-amber-400/70">Chaves</p>
              </div>
              <div className="text-center p-3 bg-amber-950/30 border border-amber-900/30 rounded-xl">
                <Circle className="w-6 h-6 text-amber-400 mx-auto mb-1" />
                <p className="text-[10px] text-amber-400/70">Círculo</p>
              </div>
            </div>
          </div>
        )}

        {/* Game Screen */}
        {gamePhase !== 'menu' && (
          <>
            {/* Battle info bar */}
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-600">Rodada {round}</span>
                <span className="text-xs text-amber-800">|</span>
                <span className="text-xs text-amber-600">Turno {turn}</span>
              </div>
              <div className="flex items-center gap-3">
                {combo > 1 && (
                  <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-950/50 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3" />
                    Combo x{combo}
                  </span>
                )}
                <span className="text-xs text-amber-500">{Math.round(score)} pts</span>
              </div>
            </div>

            {/* Timer */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <Timer className={`w-4 h-4 ${timeRemaining <= 10 ? 'text-red-400' : 'text-amber-500'}`} />
              <span className={`text-2xl font-bold font-mono ${
                timeRemaining <= 10 ? 'text-red-400 animate-pulse'
                : timeRemaining <= 20 ? 'text-amber-400'
                : 'text-amber-300'
              }`}>
                {timeRemaining}
              </span>
              <span className="text-xs text-amber-600">s</span>
            </div>

            {/* HP Bars */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Player */}
              <div className="bg-black/40 border border-amber-900/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-amber-400/80 font-medium flex items-center gap-1">
                    <Heart className="w-3 h-3 text-red-400" />
                    {player.name}
                  </span>
                  <span className="text-xs text-amber-500 font-mono">{player.hp}/{player.maxHp}</span>
                </div>
                <div className="h-3 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                  <div
                    className={`h-full transition-all duration-500 ${getHpColor(player)}`}
                    style={{ width: `${(player.hp / player.maxHp) * 100}%` }}
                  />
                </div>
                {player.shield > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Shield className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] text-blue-400">{player.shield} escudo</span>
                  </div>
                )}
              </div>

              {/* Enemy */}
              <div className="bg-black/40 border border-red-900/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-red-400/80 font-medium flex items-center gap-1">
                    <Swords className="w-3 h-3 text-red-400" />
                    {enemy.name}
                  </span>
                  <span className="text-xs text-red-500/70 font-mono">{enemy.hp}/{enemy.maxHp}</span>
                </div>
                <div className="h-3 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                  <div
                    className="h-full bg-red-600 transition-all duration-500"
                    style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
                  />
                </div>
                {enemy.shield > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Shield className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] text-blue-400">{enemy.shield} escudo</span>
                  </div>
                )}
                {/* Weakness + element info */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                  {enemy.weakness && (
                    <div className="flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5 text-yellow-400" />
                      <span className="text-[9px] text-yellow-400/80">Fraqueza:</span>
                      <span className="text-[9px] text-yellow-300 font-semibold">{SIGILS[enemy.weakness].namePt}</span>
                    </div>
                  )}
                  {enemy.element && (
                    <div className="flex items-center gap-0.5">
                      <span className="text-[9px] text-amber-600/70">Elem:</span>
                      <span className="text-[9px] text-amber-400/80">{SIGILS[enemy.element].namePt}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Canvas */}
            <GameCanvas
              onGlyphComplete={handleGlyphComplete}
              isDrawingEnabled={gamePhase === 'drawing'}
              glowColor={canvasGlowColor}
              elementName={canvasElementName}
            />

            {/* Detected components */}
            {(detectedSigils.length > 0 || detectedSigns.length > 0) && (
              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                {detectedSigils.map((s, i) => (
                  <span key={`sigil-${i}`}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs"
                    style={{
                      background: `${elementColors[s]}22`,
                      border: `1px solid ${elementColors[s]}55`,
                      color: elementColors[s],
                    }}
                  >
                    {elementIcons[s]}
                    {SIGILS[s].namePt}
                  </span>
                ))}
                {detectedSigns.map((s, i) => (
                  <span key={`sign-${i}`} className="flex items-center gap-1 px-2.5 py-1 bg-pink-950/40 border border-pink-800/40 rounded-lg text-xs text-pink-300">
                    <Key className="w-3 h-3" />
                    {SIGNS[s].namePt}
                  </span>
                ))}
              </div>
            )}

            {/* Precision details */}
            <div className="mt-3">
              <PrecisionDetails precision={currentPrecision} />
            </div>

            {/* Phase indicator */}
            <div className="mt-3 text-center">
              {gamePhase === 'drawing' && (
                <p className="text-xs text-amber-500/60 animate-pulse">
                  Desenhe o sigilo, chaves e feche o círculo...
                </p>
              )}
              {gamePhase === 'evaluating' && (
                <p className="text-xs text-amber-400">Avaliando o glifo...</p>
              )}
              {gamePhase === 'enemy_turn' && (
                <p className="text-xs text-red-400 animate-pulse">{enemyAction || `${enemy.name} está agindo...`}</p>
              )}
              {gamePhase === 'casting' && (
                <p className="text-xs text-amber-300/60 animate-pulse">Magia sendo lançada...</p>
              )}
            </div>

            {/* Battle Log */}
            <div className="mt-4 bg-black/30 border border-amber-900/20 rounded-xl p-3 max-h-32 overflow-y-auto">
              <p className="text-[10px] text-amber-700 mb-1 uppercase tracking-wider">Registro de Batalha</p>
              <div className="space-y-1">
                {logMessages.slice(0, 5).map((msg, i) => (
                  <p key={i} className="text-xs text-amber-400/70">{msg}</p>
                ))}
              </div>
            </div>
          </>
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
      {showGrimoire && <GrimoirePanel spells={spells} onClose={() => setShowGrimoire(false)} />}
      {showGuide && <GuidePanel onClose={() => setShowGuide(false)} />}
    </div>
  );
}
