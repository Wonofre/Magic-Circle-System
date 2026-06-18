import type { ReactNode } from "react";
import type { CastResult } from "@/lib/spellEngine";
import type { EnemySpellPlan } from "@/lib/spell/enemySpellAI";
import type { BattlefieldEffect, Entity, GamePhase, PrecisionBreakdown, StatusEffect } from "@/types/magic";
import type { ElementSigilId } from "@/types/magicFormulaV2";
import type { RecognitionTelemetryEvent } from "@/types/telemetry";
import type { SpellCard } from "@/types/spellCard";
import { getGlyphById } from "@/data/glyphTemplates";
import { getRuneByTemplateId } from "@/data/magicOntology";
import { elementalAccent, paperSurfaceBackground } from "@/lib/ui/themeTokens";
import { EnemyCastPreview } from "@/components/EnemyCastPreview";
import { MagicVfxLayer } from "@/components/MagicVfxLayer";
import { MandalaSummaryPanel } from "@/components/MandalaSummaryPanel";
import { PrecisionDetails } from "@/components/PrecisionDetails";
import {
  Activity,
  BookMarked,
  CloudLightning,
  Droplets,
  Flame,
  Heart,
  Leaf,
  Moon,
  Mountain,
  Shield,
  Snowflake,
  Sparkles,
  Sun,
  Swords,
  Timer,
  TrendingUp,
  Wind,
  Zap,
  Circle,
} from "lucide-react";

type BattlePhase = Exclude<GamePhase, "menu">;

type VfxCastResult = CastResult & {
  readonly spellHash?: string;
  readonly spellCard?: SpellCard;
  readonly telemetry?: RecognitionTelemetryEvent;
};

interface BattleSceneShellProps {
  readonly phase: BattlePhase;
  readonly round: number;
  readonly turn: number;
  readonly combo: number;
  readonly score: number;
  readonly timeRemaining: number;
  readonly player: Entity;
  readonly enemy: Entity;
  readonly enemyAction: string;
  readonly enemyCastPlan: EnemySpellPlan | null;
  readonly drawingInkSpent: number;
  readonly detectedFormula: string;
  readonly detectedRuneIds: readonly string[];
  readonly currentPrecision: PrecisionBreakdown | null;
  readonly castResult: VfxCastResult | null;
  readonly battlefieldEffects: readonly BattlefieldEffect[];
  readonly logMessages: readonly string[];
  readonly canvasSlot: ReactNode;
}

const elementIcons: Record<ElementSigilId, ReactNode> = {
  IGNIS: <Flame className="w-3.5 h-3.5 text-orange-500" />,
  AQUA: <Droplets className="w-3.5 h-3.5 text-blue-500" />,
  TERRA: <Mountain className="w-3.5 h-3.5 text-stone-600" />,
  VENTUS: <Wind className="w-3.5 h-3.5 text-emerald-500" />,
  LUX: <Sun className="w-3.5 h-3.5 text-yellow-500" />,
  UMBRA: <Moon className="w-3.5 h-3.5 text-purple-500" />,
  VITA: <Leaf className="w-3.5 h-3.5 text-green-500" />,
  GELU: <Snowflake className="w-3.5 h-3.5 text-cyan-500" />,
  FULMEN: <CloudLightning className="w-3.5 h-3.5 text-yellow-500" />,
  SANGUIS: <Circle className="w-3.5 h-3.5 text-rose-600" />,
  MENS: <Circle className="w-3.5 h-3.5 text-violet-500" />,
};

const phaseCopy: Record<BattlePhase, string> = {
  drawing: "Desenhe a formula na pagina ativa",
  evaluating: "O grimorio esta lendo o traco",
  casting: "A magia esta atravessando o papel",
  enemy_turn: "Oponente conjurando",
  victory: "Selo de vitoria aberto",
  defeat: "O circulo perdeu estabilidade",
};

const getHpColor = (entity: Entity) => {
  const ratio = entity.hp / entity.maxHp;
  if (ratio > 0.6) return "bg-emerald-600";
  if (ratio > 0.3) return "bg-amber-600";
  return "bg-red-600";
};

const statusLabel: Record<StatusEffect["type"], string> = {
  burn: "queimando",
  wet: "molhado",
  stun: "atordoado",
  shield: "escudo",
  empower: "potencia",
  slow: "lento",
  frozen: "congelado",
  cursed: "maldito",
  poisoned: "veneno",
  rooted: "preso",
  blinded: "cego",
  revealed: "revelado",
  bleeding: "sangrando",
  confused: "confuso",
  regeneration: "regenerando",
};

const fieldLabel: Record<BattlefieldEffect["type"], string> = {
  rain: "chuva",
  ignited: "ignicao",
  stonewall: "muralha",
  gust: "rajada",
  revelation: "revelacao",
  shadow_veil: "veu",
  life_surge: "surto vital",
  frozen_ground: "gelo",
  storm_charge: "carga",
  blood_mark: "marca",
  mind_haze: "nevoa mental",
  trap_zone: "armadilha",
};

function ResourceBar({
  label,
  value,
  max,
  className,
}: {
  readonly label: string;
  readonly value: number;
  readonly max: number;
  readonly className: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em] text-[#6b3b1b]">
        <span>{label}</span>
        <span className="font-mono tracking-normal">{Number.isInteger(value) ? value : value.toFixed(1)}/{max}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-sm border border-[#6d3f1f]/30 bg-[#6d3f1f]/20">
        <div className={`h-full transition-all duration-300 ${className}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
      </div>
    </div>
  );
}

function EntityLedger({ entity, tone }: { readonly entity: Entity; readonly tone: "player" | "enemy" }) {
  const isEnemy = tone === "enemy";

  return (
    <section className="battle-ledger">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#3b2114]">
            {isEnemy ? <Swords className="w-3.5 h-3.5 text-red-700" /> : <Heart className="w-3.5 h-3.5 text-red-700" />}
            <span className="truncate">{entity.name}</span>
          </p>
          <p className="mt-0.5 text-[10px] text-[#7c5128]">{isEnemy ? "Altar adversario" : "Pagina da aprendiz"}</p>
        </div>
        {entity.shield > 0 && (
          <span className="inline-flex items-center gap-1 rounded-sm border border-sky-800/30 bg-sky-100/50 px-1.5 py-0.5 text-[10px] text-sky-900">
            <Shield className="w-3 h-3" />
            {entity.shield}
          </span>
        )}
      </div>
      <div className="space-y-2">
        <ResourceBar label="Vida" value={entity.hp} max={entity.maxHp} className={getHpColor(entity)} />
        <ResourceBar label="Tinta" value={entity.ink} max={entity.maxInk} className={isEnemy ? "bg-violet-600" : "bg-cyan-600"} />
      </div>
      {isEnemy && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-[#4b2a19]">
          {entity.weakness && (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-sky-800/25 bg-sky-100/60 px-2 py-1">
              <Zap className="w-3 h-3 text-sky-800" />
              <span className="font-medium text-sky-900">Fraco a {elementalAccent[entity.weakness].name}</span>
              {elementIcons[entity.weakness]}
            </span>
          )}
          {entity.resistance && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-stone-900/10 px-1.5 py-0.5">
              <Shield className="w-3 h-3 text-stone-700" />
              resiste {elementalAccent[entity.resistance].name}
            </span>
          )}
        </div>
      )}
      {entity.status.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entity.status.slice(0, 5).map((status) => (
            <span key={status.type} className="rounded-sm border border-[#6d3f1f]/20 bg-[#6d3f1f]/10 px-1.5 py-0.5 text-[10px] text-[#4b2a19]">
              {statusLabel[status.type]} {status.duration}t
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export function BattleSceneShell({
  phase,
  round,
  turn,
  combo,
  score,
  timeRemaining,
  player,
  enemy,
  enemyAction,
  enemyCastPlan,
  drawingInkSpent,
  detectedFormula,
  detectedRuneIds,
  currentPrecision,
  castResult,
  battlefieldEffects,
  logMessages,
  canvasSlot,
}: BattleSceneShellProps) {
  const timerCritical = timeRemaining <= 10;

  return (
    <main className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-3 pb-6 sm:px-5">
      <section className="enemy-altar">
        <div className="enemy-portrait">
          <Swords className="w-5 h-5 text-red-200" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-display truncate text-sm font-bold uppercase tracking-[0.2em] text-[#e8d4a8]">{enemy.name}</h2>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#c9a227]/65 italic">Intenção: {phase === "enemy_turn" ? enemyAction || "preparando fórmula" : "observando seu círculo"}</span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <ResourceBar label="Vida inimiga" value={enemy.hp} max={enemy.maxHp} className="bg-red-600" />
            <ResourceBar label="Tinta inimiga" value={enemy.ink} max={enemy.maxInk} className="bg-violet-500" />
          </div>
        </div>
      </section>

      <section className="battle-book" style={{ background: paperSurfaceBackground }}>
        <div className="book-spine" />
        <aside className="book-page book-page-left">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#7b4b20]">Duelo</p>
              <h1 className="font-display text-xl font-bold text-[#2a1810]">Rodada {round}, Turno {turn}</h1>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#7b4b20]">Score</p>
              <p className="font-mono text-lg font-bold text-[#321b12]">{Math.round(score)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <EntityLedger entity={player} tone="player" />
            <EntityLedger entity={enemy} tone="enemy" />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="battle-token">
              <Timer className={`w-4 h-4 ${timerCritical ? "text-red-700" : "text-[#6f421c]"}`} />
              <span className={timerCritical ? "text-red-700" : ""}>{timeRemaining}s</span>
            </div>
            <div className="battle-token">
              <TrendingUp className="w-4 h-4 text-[#6f421c]" />
              <span>x{Math.max(1, combo)}</span>
            </div>
            <div className="battle-token">
              <Activity className="w-4 h-4 text-[#6f421c]" />
              <span>{phase === "enemy_turn" ? "IA" : "Voce"}</span>
            </div>
          </div>

          <section className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#7b4b20]">
              <BookMarked className="w-3.5 h-3.5" />
              Marginalia
            </div>
            <div className="battle-marginalia">
              {logMessages.slice(0, 5).map((message, index) => (
                <p key={`${message}-${index}`}>{message}</p>
              ))}
            </div>
          </section>

          {battlefieldEffects.length > 0 && (
            <section className="mt-4">
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[#7b4b20]">Campos</p>
              <div className="flex flex-wrap gap-1.5">
                {battlefieldEffects.map((effect) => (
                  <span key={effect.id} className="rune-chip">
                    <Sparkles className="w-3 h-3" />
                    {fieldLabel[effect.type]} {effect.duration}t
                  </span>
                ))}
              </div>
            </section>
          )}

          {detectedRuneIds.length > 0 && (
            <section className="mt-4">
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[#7b4b20]">Runas lidas</p>
              <div className="flex flex-wrap gap-1.5">
                {detectedRuneIds.slice(0, 8).map((id) => {
                  const glyph = getGlyphById(id);
                  const rune = getRuneByTemplateId(id);
                  const element = rune?.binding.type === "sigil" ? rune.binding.sigilId : undefined;
                  return (
                    <span key={id} className="rune-chip">
                      {element ? elementIcons[element] : <Sparkles className="w-3 h-3" />}
                      {rune?.name ?? glyph?.display_name ?? id}
                    </span>
                  );
                })}
              </div>
            </section>
          )}
        </aside>

        <section className="book-page book-page-right">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#7b4b20]">Pagina ativa</p>
              <p className="text-sm font-semibold text-[#321b12]">{phaseCopy[phase]}</p>
            </div>
            {drawingInkSpent > 0 && phase === "drawing" && (
              <span className="rounded-sm border border-cyan-900/20 bg-cyan-100/50 px-2 py-1 text-[10px] font-semibold text-cyan-900">
                tinta -{drawingInkSpent.toFixed(1)}
              </span>
            )}
          </div>

          <div className="relative">
            <MagicVfxLayer result={castResult} />
            {canvasSlot}
          </div>

          {detectedFormula && (
            <p className="mt-3 text-center text-[11px] font-medium text-[#563119]">{detectedFormula}</p>
          )}

          <div className="mt-3">
            <PrecisionDetails precision={currentPrecision} />
          </div>

          <MandalaSummaryPanel
            spellName={castResult?.spellName}
            formula={castResult?.spellCard?.formula}
            spellCard={castResult?.spellCard}
            precision={castResult?.precision}
            feedback={castResult?.feedback}
            isSuccess={castResult?.isSuccess}
          />

          <div className="mt-3 text-center">
            <p className={`text-xs ${phase === "enemy_turn" ? "text-red-800" : "text-[#6f421c]"} ${phase === "drawing" || phase === "casting" || phase === "enemy_turn" ? "animate-pulse" : ""}`}>
              {phase === "enemy_turn" ? enemyAction || `${enemy.name} esta agindo...` : phaseCopy[phase]}
            </p>
          </div>

          {phase === "enemy_turn" && <EnemyCastPreview plan={enemyCastPlan} />}
        </section>
      </section>
    </main>
  );
}
