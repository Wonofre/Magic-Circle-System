import { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Circle, Droplets, Flame, Key, Shield, Sparkles, Swords, X } from "lucide-react";
import { activeRuneDefinitions } from "@/data/magicOntology";
import { defaultGrimoireLoadout, getAllowedGlyphIds } from "@/lib/spell/codexStore";
import { getGlyphById } from "@/data/glyphTemplates";
import {
  getRuneNameForTemplate,
  getRuneBindingLabel,
  getTemplateRoleLabel,
  kindLabels,
  riskLabels,
} from "@/lib/ui/runeCatalogPresentation";
import type { CodexSpellEntry, GrimoireLoadout } from "@/types/codex";
import type { MagicFormulaV2, MagicPointV2 } from "@/types/magicFormulaV2";

interface CodexPanelProps {
  readonly entries: readonly CodexSpellEntry[];
  readonly loadout?: GrimoireLoadout;
  readonly onClose: () => void;
}

type CodexFilter = "all" | "discovered" | "practiced" | "mastered" | "loadout";

const filters: readonly CodexFilter[] = ["all", "discovered", "practiced", "mastered", "loadout"];

const filterLabel: Record<CodexFilter, string> = {
  all: "Tudo",
  discovered: "Descobertas",
  practiced: "Praticadas",
  mastered: "Dominadas",
  loadout: "Regras",
};

const masteryLabel: Record<CodexSpellEntry["mastery"], string> = {
  discovered: "descoberta",
  practiced: "praticada",
  mastered: "dominada",
};

const kindIcon = (kind: CodexSpellEntry["kind"]) => {
  if (kind === "defense") return <Shield className="w-4 h-4 text-sky-300" />;
  if (kind === "support") return <Sparkles className="w-4 h-4 text-emerald-300" />;
  if (kind === "utility" || kind === "control") return <Sparkles className="w-4 h-4 text-violet-300" />;
  return <Swords className="w-4 h-4 text-red-300" />;
};

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const unique = <T,>(values: readonly T[]): readonly T[] => [...new Set(values)];

const getEntryCodexTemplateIds = (entry: CodexSpellEntry): readonly string[] =>
  entry.codexTemplateIds ?? entry.drawnTemplateIds ?? entry.componentTemplateIds;

const projectFormulaPoint = (formula: MagicFormulaV2, point: MagicPointV2) => {
  const circle = formula.castingCircle;
  if (!circle) return { x: point.x, y: point.y };
  const scale = 42 / Math.max(1, circle.radius);
  return {
    x: 50 + (point.x - circle.center.x) * scale,
    y: 50 + (point.y - circle.center.y) * scale,
  };
};

function FormulaPreviewV2({ formula }: { readonly formula: MagicFormulaV2 }) {
  const color = formula.visual.elementColor;
  const entityCenters = new Map<string, MagicPointV2>([
    ...formula.sigils.map((sigil) => [sigil.id, sigil.center] as const),
    ...formula.keys.map((key) => [key.id, key.center] as const),
    ...(formula.sigilContainment ? [[formula.sigilContainment.id, formula.sigilContainment.center] as const] : []),
  ]);

  return (
    <svg viewBox="0 0 100 100" className="w-[72px] h-[72px] overflow-visible">
      <rect x="4" y="4" width="92" height="92" rx="8" fill="rgba(0,0,0,0.14)" />
      <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="2.2" opacity="0.75" />
      {formula.sigilContainment && (
        <circle cx="50" cy="50" r={Math.max(8, formula.sigilContainment.radius / Math.max(1, formula.castingCircle?.radius ?? 1) * 42)} fill="none" stroke={color} strokeWidth="1" opacity="0.34" />
      )}
      {formula.channels.map((channel) => {
        const from = entityCenters.get(channel.fromId);
        const to = entityCenters.get(channel.toId);
        if (!from || !to) return null;
        const a = projectFormulaPoint(formula, from);
        const b = projectFormulaPoint(formula, to);
        const control = channel.arcCenter ? projectFormulaPoint(formula, channel.arcCenter) : { x: 50, y: 50 };
        return (
          <path
            key={channel.id}
            d={`M ${a.x.toFixed(2)} ${a.y.toFixed(2)} Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`}
            fill="none"
            stroke={color}
            strokeWidth={channel.geometry === "invalid_straight" ? 0.8 : 1.5}
            opacity={channel.geometry === "invalid_straight" ? 0.38 : 0.72}
          />
        );
      })}
      {formula.sigils.map((sigil) => {
        const point = projectFormulaPoint(formula, sigil.center);
        return <circle key={sigil.id} cx={point.x} cy={point.y} r="4.2" fill={color} opacity="0.92" />;
      })}
      {formula.keys.map((key) => {
        const point = projectFormulaPoint(formula, key.center);
        return (
          <g key={key.id}>
            <circle cx={point.x} cy={point.y} r="3.4" fill="rgba(0,0,0,0.55)" stroke={color} strokeWidth="1.2" />
            {key.scope === "dormant" && <circle cx={point.x} cy={point.y} r="5.8" fill="none" stroke="#ef4444" strokeWidth="0.8" />}
          </g>
        );
      })}
    </svg>
  );
}

function SpellTemplatePreview({ entry }: { readonly entry: CodexSpellEntry }) {
  if (entry.formulaV2) return <FormulaPreviewV2 formula={entry.formulaV2} />;
  return <Circle className="w-8 h-8 text-amber-700" />;
}

export function CodexPanel({
  entries,
  loadout = defaultGrimoireLoadout,
  onClose,
}: CodexPanelProps) {
  const [filter, setFilter] = useState<CodexFilter>("all");

  const filteredEntries = useMemo(() => {
    if (filter === "loadout") return entries;
    if (filter === "all") return entries;
    return entries.filter((entry) => entry.mastery === filter);
  }, [entries, filter]);

  const discoveredGlyphIds = unique(entries.flatMap(getEntryCodexTemplateIds));
  const masteredCount = entries.filter((entry) => entry.mastery === "mastered").length;
  const allowedGlyphIds = useMemo(() => getAllowedGlyphIds(loadout, entries), [entries, loadout]);
  const allowedRunes = activeRuneDefinitions.filter((rune) => allowedGlyphIds.has(rune.templateId));
  const lockedRunes = activeRuneDefinitions.filter((rune) => !allowedGlyphIds.has(rune.templateId));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#170f13] border border-amber-700/60 rounded-lg max-w-2xl w-full max-h-[88vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-amber-900/40">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="text-xl font-bold text-amber-200">Codex V2</h2>
              <p className="text-xs text-amber-600/80">
                {entries.length} formulas v2, {masteredCount} dominadas
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-amber-900/30 rounded-lg transition-colors" title="Fechar">
            <X className="w-5 h-5 text-amber-400" />
          </button>
        </div>

        <div className="flex gap-1.5 p-3 overflow-x-auto border-b border-amber-900/30">
          {filters.map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                filter === option
                  ? "bg-amber-700 text-amber-100"
                  : "bg-amber-950/50 text-amber-600/70 hover:bg-amber-900/40"
              }`}
            >
              {filterLabel[option]}
            </button>
          ))}
        </div>

        {filter === "loadout" && (
          <div className="p-4 border-b border-amber-900/30 bg-black/20">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-amber-900/25 bg-black/20 p-3">
                <p className="text-amber-500 mb-2 flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  Glifos
                </p>
                <p className="text-amber-300/80">{allowedRunes.length} permitidos</p>
                <p className="text-[10px] text-amber-700">{lockedRunes.length} fora do loadout</p>
              </div>
              <div className="rounded-lg border border-amber-900/25 bg-black/20 p-3">
                <p className="text-amber-500 mb-2 flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  Regras v2
                </p>
                <p className="text-amber-300/80">ligacoes entre chaves devem ser curvas</p>
                <p className="text-[10px] text-amber-700">efeitos, campos e dissipacao estao ativos</p>
              </div>
              <div className="rounded-lg border border-amber-900/25 bg-black/20 p-3">
                <p className="text-amber-500 mb-2 flex items-center gap-1">
                  <Droplets className="w-3 h-3" />
                  Tintas
                </p>
                <p className="text-amber-300/80">{loadout.allowedInkInfusionIds.length || 1} base</p>
              </div>
              <div className="rounded-lg border border-amber-900/25 bg-black/20 p-3">
                <p className="text-amber-500 mb-2 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Risco
                </p>
                <p className="text-amber-300/80">{riskLabels[loadout.maxRiskLevel]}</p>
                <p className="text-[10px] text-amber-700">beleza nao substitui uma formula completa</p>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-y-auto max-h-[58vh] p-3 space-y-2">
          {filteredEntries.length === 0 ? (
            <div className="py-10 text-center text-amber-700">
              <Circle className="w-8 h-8 mx-auto mb-2 opacity-60" />
              <p className="text-sm">Nenhuma magia registrada ainda</p>
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <div key={entry.spellHash} className="p-3 rounded-lg border bg-amber-950/30 border-amber-800/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-20 h-20 rounded-lg bg-black/30 border border-amber-800/25 flex items-center justify-center flex-shrink-0">
                    <SpellTemplatePreview entry={entry} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {kindIcon(entry.kind)}
                      <span className="font-bold text-amber-200 text-sm truncate">{entry.name}</span>
                      <span className="text-[10px] bg-black/30 text-amber-400/80 px-1.5 py-0.5 rounded">
                        {masteryLabel[entry.mastery]}
                      </span>
                      <span className="text-[10px] bg-black/30 text-amber-500/80 px-1.5 py-0.5 rounded">
                        {kindLabels[entry.kind]}
                      </span>
                    </div>
                    <p className="text-xs text-amber-600/80 mb-2">{entry.effectSummary}</p>
                    {entry.formulaV2 && (
                      <p className="text-[10px] text-amber-700 mb-2">
                        simetria {Math.round(entry.formulaV2.symmetry.overall * 100)}% / canais {entry.formulaV2.channels.length} / {entry.formulaV2.visual.rank}
                      </p>
                    )}
                    <p className="text-[10px] text-amber-700 font-mono mb-2">
                      {entry.formulaHash ?? entry.spellHash}
                      {entry.visualHash ? <span className="block text-amber-800/80">{entry.visualHash}</span> : null}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {getEntryCodexTemplateIds(entry).slice(0, 8).map((id) => (
                        <span key={id} className="text-[10px] bg-black/35 text-amber-300/80 px-2 py-0.5 rounded">
                          {getGlyphById(id)?.display_name ?? getRuneNameForTemplate(id)}
                          <span className="text-amber-600/80"> / {getTemplateRoleLabel(id)} / {getRuneBindingLabel(id)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-amber-500/80 whitespace-nowrap">
                    <p>{entry.castCount} usos</p>
                    <p>prec. {entry.bestPrecision}</p>
                    <p>tinta {entry.inkCost}</p>
                    <p>{formatDate(entry.lastCastAt)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-amber-900/30 bg-black/20">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-amber-600/80">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>{discoveredGlyphIds.length} glifos de catalogo registrados em formulas v2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
