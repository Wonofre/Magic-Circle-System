import { useEffect, useState } from "react";
import {
  BookOpen,
  Circle,
  Droplets,
  Flame,
  GitBranch,
  Hexagon,
  Key,
  Scroll,
  Shield,
  Swords,
  X,
} from "lucide-react";
import { getGlyphById } from "@/data/glyphTemplates";
import { activeRuneDefinitions } from "@/data/magicOntology";
import { magicCatalogV2 } from "@/data/magicCatalogV2";
import { defaultGrimoireLoadout, getAllowedGlyphIds } from "@/lib/spell/codexStore";
import {
  getRuneBindingLabel,
  getRuneNameForTemplate,
  getTemplateRoleLabel,
  kindLabels,
  riskLabels,
} from "@/lib/ui/runeCatalogPresentation";
import { GlyphTemplatePreview } from "@/components/GlyphTemplatePreview";
import type { CodexSpellEntry, GrimoireLoadout } from "@/types/codex";
import type { GlyphTemplate } from "@/types/glyphTemplates";
import type { MagicCatalogSigilV2 } from "@/data/magicCatalogV2";
import type { MagicKeyId } from "@/types/magicFormulaV2";

export type CodexBookTab = "learn" | "grimoire" | "discoveries";

export const TUTORIAL_STEPS = [
  {
    id: 1,
    title: "Trace o circulo externo por ultimo",
    desc: "O circulo grande envolve toda a formula. Feche-o para conjurar automaticamente.",
  },
  {
    id: 2,
    title: "Copie Aqua no centro",
    desc: "Desenhe o sigilo de agua dentro do circulo de contencao central.",
    templateId: "ELEMENT_AQUA",
  },
  {
    id: 3,
    title: "Desenhe o escopo da chave",
    desc: "Circulo pequeno ao redor da chave cria o escopo local do projetil.",
  },
  {
    id: 4,
    title: "Copie a chave de Projetil",
    desc: "Trace a seta de projetil dentro do escopo da chave.",
    templateId: "FORM_PROJECTILE",
  },
  {
    id: 5,
    title: "Ligue sigilo e chave",
    desc: "Canal curvo ou reto do centro ate a chave, sem cruzar o circulo externo.",
  },
  {
    id: 6,
    title: "Feche o circulo externo",
    desc: "Ao fechar, a mandala e enviada. Use Desfazer ou Ctrl+Z antes disso se precisar corrigir.",
  },
] as const;

interface CodexBookProps {
  readonly entries: readonly CodexSpellEntry[];
  readonly loadout?: GrimoireLoadout;
  readonly initialTab?: CodexBookTab;
  readonly activeTutorialStep?: number;
  readonly onClose: () => void;
  readonly onStartTutorial?: () => void;
  readonly onTutorialStepChange?: (step: number) => void;
}

const knownGlyphIds = new Set(defaultGrimoireLoadout.knownGlyphIds);

const glyphsForSigil = (sigilId: MagicCatalogSigilV2["id"]): readonly GlyphTemplate[] =>
  activeRuneDefinitions
    .filter((rune) => rune.binding.type === "sigil" && rune.binding.sigilId === sigilId)
    .map((rune) => getGlyphById(rune.templateId))
    .filter((glyph): glyph is GlyphTemplate => Boolean(glyph));

const glyphsForKey = (keyId: MagicKeyId): readonly GlyphTemplate[] =>
  activeRuneDefinitions
    .filter((rune) => rune.binding.type === "key" && rune.binding.keyId === keyId)
    .map((rune) => getGlyphById(rune.templateId))
    .filter((glyph): glyph is GlyphTemplate => Boolean(glyph));

const ruleCards = [
  { icon: <Circle className="w-4 h-4" />, title: "Circulo de conjuracao", desc: "Maior circulo externo. Obrigatorio, fechado e sem canais vazando para fora." },
  { icon: <Hexagon className="w-4 h-4" />, title: "Sigilo central", desc: "Define o que a magia e. Contencao melhora estabilidade visual." },
  { icon: <Key className="w-4 h-4" />, title: "Chaves", desc: "Definem forma, modificador ou acao. Circulo pequeno cria escopo local." },
  { icon: <GitBranch className="w-4 h-4" />, title: "Canais", desc: "Ligue chaves a borda da contencao central. Entre chaves, use arco." },
];

const BindingGlyphs = ({ glyphs }: { readonly glyphs: readonly GlyphTemplate[] }) => (
  <div className="flex flex-wrap gap-1.5">
    {glyphs.map((glyph) => {
      const known = knownGlyphIds.has(glyph.id);
      return (
        <div
          key={glyph.id}
          className={`flex items-center gap-1 rounded-sm border px-1.5 py-1 ${
            known
              ? "border-amber-800/35 bg-black/20 text-amber-300"
              : "border-amber-900/20 bg-black/10 text-amber-600/70"
          }`}
        >
          <span className="flex h-7 w-7 items-center justify-center">
            <GlyphTemplatePreview glyph={glyph} />
          </span>
          <span className="max-w-[92px] truncate text-[10px]">{glyph.display_name}</span>
        </div>
      );
    })}
  </div>
);

export function CodexBook({
  entries,
  loadout = defaultGrimoireLoadout,
  initialTab = "learn",
  activeTutorialStep = 1,
  onClose,
  onStartTutorial,
  onTutorialStepChange,
}: CodexBookProps) {
  const [tab, setTab] = useState<CodexBookTab>(initialTab);
  const allowedGlyphIds = getAllowedGlyphIds(loadout, entries);
  const allowedRunes = activeRuneDefinitions.filter((rune) => allowedGlyphIds.has(rune.templateId));
  const lockedRunes = activeRuneDefinitions.filter((rune) => !allowedGlyphIds.has(rune.templateId));
  const masteredCount = entries.filter((entry) => entry.mastery === "mastered").length;

  const tabs: { readonly id: CodexBookTab; readonly label: string }[] = [
    { id: "learn", label: "Regras & Tutorial" },
    { id: "grimoire", label: "Grimorio" },
    { id: "discoveries", label: "Descobertas" },
  ];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="wha-modal-overlay">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-[#c9a227]/40 bg-[#14080c]/95 shadow-2xl animate-panel-rise">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[#c9a227]/20 p-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-[#c9a227]" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#e8c86a] tracking-wider">Grimório Vivo</h2>
              <p className="text-[10px] text-[#c9a227]/70">
                {entries.length} formulas · {masteredCount} dominadas · risco {riskLabels[loadout.maxRiskLevel]}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="wha-icon-btn" title="Fechar">
            <X className="h-5 w-5 text-[#c9a227]" />
          </button>
        </div>

        <div className="flex flex-shrink-0 border-b border-[#c9a227]/15">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === item.id
                  ? "border-b-2 border-[#c9a227] bg-[#2a1018]/50 text-[#e8d4a8]"
                  : "text-[#c9a227]/60 hover:text-[#e8c86a]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {tab === "learn" && (
            <section className="space-y-4">
              <div className="rounded-lg border border-sky-800/35 bg-sky-950/25 p-4">
                <p className="text-sm font-bold text-sky-200">Projetil de Aqua — primeira magia</p>
                <p className="mt-1 text-xs text-sky-200/75">
                  O combate pausa enquanto o grimorio estiver aberto. Tracar no canvas segue a ordem abaixo.
                </p>
              </div>

              <ol className="space-y-2.5">
                {TUTORIAL_STEPS.map((step) => {
                  const isActive = step.id === activeTutorialStep;
                  const glyph = "templateId" in step && step.templateId
                    ? getGlyphById(step.templateId)
                    : null;
                  return (
                    <li
                      key={step.id}
                      className={`flex gap-3 rounded-lg border p-3 transition-colors ${
                        isActive
                          ? "border-sky-700/45 bg-sky-950/30"
                          : "border-amber-900/25 bg-amber-950/25"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onTutorialStepChange?.(step.id)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isActive ? "bg-sky-700 text-sky-50" : "bg-amber-700 text-amber-50"
                        }`}
                      >
                        {step.id}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-amber-300">{step.title}</p>
                        <p className="mt-1 text-xs text-amber-300/70">{step.desc}</p>
                        {glyph && (
                          <div className="mt-2">
                            <BindingGlyphs glyphs={[glyph]} />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {onStartTutorial && (
                <button
                  type="button"
                  onClick={onStartTutorial}
                  className="w-full rounded-lg border border-sky-700/45 bg-sky-900/35 px-4 py-3 text-sm font-bold text-sky-100 transition hover:bg-sky-800/45"
                >
                  Tracar no canvas
                </button>
              )}

              <div className="border-t border-amber-900/30 pt-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-amber-500">Regras da mandala</p>
                <div className="space-y-2">
                  {ruleCards.map((card) => (
                    <div key={card.title} className="flex items-start gap-3 rounded-lg border border-amber-900/20 bg-amber-950/30 p-3">
                      <div className="mt-0.5 text-amber-400">{card.icon}</div>
                      <div>
                        <p className="mb-0.5 text-xs font-semibold text-amber-300">{card.title}</p>
                        <p className="text-xs text-amber-300/70">{card.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === "grimoire" && (
            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-amber-900/25 bg-black/20 p-3">
                  <p className="mb-2 flex items-center gap-1 text-amber-500">
                    <Flame className="h-3 w-3" />
                    Glifos ativos
                  </p>
                  <p className="text-amber-300/80">{allowedRunes.length} permitidos</p>
                  <p className="text-[10px] text-amber-700">{lockedRunes.length} bloqueados nesta partida</p>
                </div>
                <div className="rounded-lg border border-amber-900/25 bg-black/20 p-3">
                  <p className="mb-2 flex items-center gap-1 text-amber-500">
                    <Shield className="h-3 w-3" />
                    Risco maximo
                  </p>
                  <p className="text-amber-300/80">{riskLabels[loadout.maxRiskLevel]}</p>
                </div>
                <div className="rounded-lg border border-amber-900/25 bg-black/20 p-3">
                  <p className="mb-2 flex items-center gap-1 text-amber-500">
                    <Droplets className="h-3 w-3" />
                    Tintas
                  </p>
                  <p className="text-amber-300/80">{loadout.allowedInkInfusionIds.length || 1} infusao base</p>
                </div>
                <div className="rounded-lg border border-amber-900/25 bg-black/20 p-3">
                  <p className="mb-2 flex items-center gap-1 text-amber-500">
                    <Scroll className="h-3 w-3" />
                    Receitas
                  </p>
                  <p className="text-amber-300/80">{loadout.allowedRecipeIds.length || "todas"} liberadas</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold text-amber-400">Sigilos do grimorio</p>
                <div className="space-y-2">
                  {magicCatalogV2.sigils.map((sigil) => (
                    <div key={sigil.id} className="rounded-lg border border-amber-900/25 bg-amber-950/25 p-3">
                      <p className="text-xs font-bold text-amber-300">{sigil.name}</p>
                      <BindingGlyphs glyphs={glyphsForSigil(sigil.id)} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold text-amber-400">Chaves do grimorio</p>
                <div className="space-y-2">
                  {magicCatalogV2.keys.map((key) => (
                    <div key={key.id} className="rounded-lg border border-amber-900/25 bg-amber-950/25 p-3">
                      <p className="text-xs font-bold text-amber-300">{key.name}</p>
                      <BindingGlyphs glyphs={glyphsForKey(key.id)} />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === "discoveries" && (
            <section className="space-y-2">
              {entries.length === 0 ? (
                <div className="py-10 text-center text-amber-700">
                  <Circle className="mx-auto mb-2 h-8 w-8 opacity-60" />
                  <p className="text-sm">Nenhuma magia registrada ainda</p>
                  <p className="mt-1 text-xs text-amber-800/80">Conjure com sucesso para arquivar aqui.</p>
                </div>
              ) : (
                entries.map((entry) => (
                  <div key={entry.spellHash} className="rounded-lg border border-amber-800/30 bg-amber-950/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          {entry.kind === "defense"
                            ? <Shield className="h-4 w-4 text-sky-300" />
                            : <Swords className="h-4 w-4 text-red-300" />}
                          <span className="truncate text-sm font-bold text-amber-200">{entry.name}</span>
                          <span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-amber-400/80">
                            {kindLabels[entry.kind]}
                          </span>
                        </div>
                        <p className="text-xs text-amber-600/80">{entry.effectSummary}</p>
                        {entry.formulaV2 && (
                          <p className="mt-1 text-[10px] text-amber-700">
                            coesao {Math.round(entry.formulaV2.symmetry.overall * 100)}% · {entry.formulaV2.visual.rank}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(entry.codexTemplateIds ?? entry.componentTemplateIds).slice(0, 6).map((id) => (
                            <span key={id} className="rounded bg-black/35 px-2 py-0.5 text-[10px] text-amber-300/80">
                              {getRuneNameForTemplate(id)} / {getTemplateRoleLabel(id)} / {getRuneBindingLabel(id)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="whitespace-nowrap text-right text-[10px] text-amber-500/80">
                        <p>{entry.castCount} usos</p>
                        <p>prec. {entry.bestPrecision}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}