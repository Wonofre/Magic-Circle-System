import { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Circle, Droplets, Flame, Key, Shield, Sparkles, Swords, X } from "lucide-react";
import { defaultGrimoireLoadout } from "@/lib/spell/codexStore";
import { getGlyphById } from "@/data/glyphTemplates";
import { SIGILS, SIGNS } from "@/lib/magicSystem";
import { PerfectGlyphPreview } from "@/components/PerfectGlyphPreview";
import type { CodexSpellEntry, GrimoireLoadout } from "@/types/codex";
import type { SigilType, SignType } from "@/types/magic";
import type { GlyphSemanticRole, GlyphTemplate } from "@/types/glyphTemplates";

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
  loadout: "Loadout",
};

const kindIcon = (kind: CodexSpellEntry["kind"]) => {
  if (kind === "defense") return <Shield className="w-4 h-4 text-sky-300" />;
  if (kind === "support") return <Sparkles className="w-4 h-4 text-emerald-300" />;
  return <Swords className="w-4 h-4 text-red-300" />;
};

const masteryLabel: Record<CodexSpellEntry["mastery"], string> = {
  discovered: "descoberta",
  practiced: "praticada",
  mastered: "dominada",
};

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const unique = <T,>(values: readonly T[]): readonly T[] => [...new Set(values)];

const roleLayout: Record<GlyphSemanticRole, { x: number; y: number; size: number }> = {
  container: { x: 40, y: 40, size: 72 },
  source: { x: 40, y: 40, size: 13 },
  connector: { x: 40, y: 40, size: 36 },
  element: { x: 40, y: 39, size: 28 },
  derived: { x: 40, y: 39, size: 28 },
  action: { x: 23, y: 40, size: 19 },
  form: { x: 57, y: 40, size: 19 },
  target: { x: 40, y: 58, size: 17 },
  defense: { x: 40, y: 57, size: 24 },
  time: { x: 22, y: 22, size: 15 },
  risk: { x: 58, y: 22, size: 15 },
  ink: { x: 40, y: 22, size: 15 },
};

const roleStrokeClass: Record<GlyphSemanticRole, string> = {
  container: "text-amber-500",
  source: "text-cyan-300",
  connector: "text-amber-300/70",
  element: "text-orange-300",
  derived: "text-sky-300",
  action: "text-red-300",
  form: "text-purple-300",
  target: "text-emerald-300",
  defense: "text-sky-300",
  time: "text-yellow-200",
  risk: "text-red-400",
  ink: "text-cyan-400",
};

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

function TemplateGlyphMark({ glyph }: { readonly glyph: GlyphTemplate }) {
  const bounds = getGlyphBounds(glyph);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const layout = roleLayout[glyph.semantic_role];
  const scale = layout.size / Math.max(width, height);
  const offsetX = layout.x - (width * scale) / 2;
  const offsetY = layout.y - (height * scale) / 2;
  const project = ([x, y]: readonly [number, number]) =>
    `${offsetX + (x - bounds.minX) * scale},${offsetY + (y - bounds.minY) * scale}`;

  return (
    <g className={roleStrokeClass[glyph.semantic_role]}>
      {glyph.strokes.map((stroke, index) => (
        <polyline
          key={`${glyph.id}-${index}`}
          points={stroke.map(project).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={glyph.semantic_role === "container" ? 3.1 : 2.35}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={glyph.semantic_role === "connector" ? 0.62 : 0.95}
        />
      ))}
    </g>
  );
}

function SpellTemplatePreview({ entry }: { readonly entry: CodexSpellEntry }) {
  const glyphs = entry.componentTemplateIds
    .map((id) => getGlyphById(id))
    .filter((glyph): glyph is GlyphTemplate => Boolean(glyph));
  const orderedGlyphs = [
    ...glyphs.filter((glyph) => glyph.semantic_role === "container"),
    ...glyphs.filter((glyph) => glyph.semantic_role === "connector"),
    ...glyphs.filter((glyph) => glyph.semantic_role === "source"),
    ...glyphs.filter((glyph) => glyph.semantic_role === "element" || glyph.semantic_role === "derived"),
    ...glyphs.filter((glyph) => glyph.semantic_role === "action"),
    ...glyphs.filter((glyph) => glyph.semantic_role === "form"),
    ...glyphs.filter((glyph) => glyph.semantic_role === "defense"),
    ...glyphs.filter((glyph) => glyph.semantic_role === "target"),
    ...glyphs.filter((glyph) => glyph.semantic_role === "time" || glyph.semantic_role === "risk" || glyph.semantic_role === "ink"),
  ];

  if (orderedGlyphs.length === 0) {
    return <Circle className="w-8 h-8 text-amber-700" />;
  }

  return (
    <svg viewBox="0 0 80 80" className="w-[72px] h-[72px] overflow-visible">
      <rect x="4" y="4" width="72" height="72" rx="10" fill="rgba(0,0,0,0.14)" />
      {orderedGlyphs.map((glyph, index) => (
        <TemplateGlyphMark key={`${entry.spellHash}-${glyph.id}-${index}`} glyph={glyph} />
      ))}
    </svg>
  );
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

  const discoveredSigils = unique(
    entries.flatMap((entry) => entry.legacySigils ?? []),
  ) as readonly SigilType[];
  const discoveredSigns = unique(
    entries.flatMap((entry) => entry.legacySigns ?? []),
  ) as readonly SignType[];
  const discoveredGlyphIds = unique(entries.flatMap((entry) => entry.componentTemplateIds));
  const masteredCount = entries.filter((entry) => entry.mastery === "mastered").length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#170f13] border border-amber-700/60 rounded-lg max-w-2xl w-full max-h-[88vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-amber-900/40">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="text-xl font-bold text-amber-200">Codex</h2>
              <p className="text-xs text-amber-600/80">
                {entries.length} magias por hash, {masteredCount} dominadas
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
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-amber-500 mb-2 flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  Sigilos
                </p>
                <p className="text-amber-300/80">{loadout.knownGlyphIds.length} conhecidos</p>
              </div>
              <div>
                <p className="text-amber-500 mb-2 flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  Chaves
                </p>
                <p className="text-amber-300/80">{loadout.allowedRecipeIds.length} receitas</p>
              </div>
              <div>
                <p className="text-amber-500 mb-2 flex items-center gap-1">
                  <Droplets className="w-3 h-3" />
                  Tintas
                </p>
                <p className="text-amber-300/80">{loadout.allowedInkInfusionIds.length || 1} base</p>
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
              <div
                key={entry.spellHash}
                className="p-3 rounded-lg border bg-amber-950/30 border-amber-800/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-20 h-20 rounded-lg bg-black/30 border border-amber-800/25 flex items-center justify-center flex-shrink-0">
                    {entry.legacySigils || entry.legacySigns ? (
                      <PerfectGlyphPreview
                        mode="spell"
                        sigils={[...(entry.legacySigils ?? [])]}
                        signs={[...(entry.legacySigns ?? [])]}
                        size={72}
                        strokeWidth={3.2}
                      />
                    ) : (
                      <SpellTemplatePreview entry={entry} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {kindIcon(entry.kind)}
                      <span className="font-bold text-amber-200 text-sm truncate">{entry.name}</span>
                      <span className="text-[10px] bg-black/30 text-amber-400/80 px-1.5 py-0.5 rounded">
                        {masteryLabel[entry.mastery]}
                      </span>
                    </div>
                    <p className="text-xs text-amber-600/80 mb-2">{entry.effectSummary}</p>
                    <p className="text-[10px] text-amber-700 font-mono mb-2">{entry.spellHash}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(entry.legacySigils ?? []).map((sigil) => (
                        <span key={sigil} className="text-[10px] bg-black/35 text-amber-300/80 px-2 py-0.5 rounded">
                          {SIGILS[sigil].namePt}
                        </span>
                      ))}
                      {(entry.legacySigns ?? []).map((sign) => (
                        <span key={sign} className="text-[10px] bg-purple-950/40 text-purple-300/80 px-2 py-0.5 rounded">
                          {SIGNS[sign].namePt}
                        </span>
                      ))}
                      {entry.componentTemplateIds.length > 0 && !entry.legacySigils && entry.componentTemplateIds.slice(0, 6).map((id) => (
                        <span key={id} className="text-[10px] bg-black/35 text-amber-300/80 px-2 py-0.5 rounded">
                          {getGlyphById(id)?.display_name ?? id}
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
            <span>{discoveredGlyphIds.length} glifos de catalogo vistos</span>
            <span>{discoveredSigils.length + discoveredSigns.length} simbolos legados vistos</span>
          </div>
        </div>
      </div>
    </div>
  );
}
