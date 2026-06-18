import { useState } from "react";
import { AlertTriangle, Circle, GitBranch, Hexagon, Key, Scale, Shield, Sparkles, Target, X } from "lucide-react";
import { getGlyphById } from "@/data/glyphTemplates";
import { activeRuneDefinitions } from "@/data/magicOntology";
import { magicCatalogV2 } from "@/data/magicCatalogV2";
import { defaultGrimoireLoadout } from "@/lib/spell/codexStore";
import { keyKindLabels, riskLabels } from "@/lib/ui/runeCatalogPresentation";
import { GlyphTemplatePreview, TemplateGlyphMark } from "@/components/GlyphTemplatePreview";
import type { GlyphTemplate } from "@/types/glyphTemplates";
import type { MagicCatalogKeyV2, MagicCatalogSigilV2 } from "@/data/magicCatalogV2";
import type { MagicKeyId } from "@/types/magicFormulaV2";

interface GuidePanelProps {
  readonly onClose: () => void;
  readonly initialTab?: GuideTab;
  readonly onStartTutorial?: () => void;
}

export type GuideTab = "tutorial" | "rules" | "catalog" | "channels" | "symmetry";

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

const sigilTags = (sigil: MagicCatalogSigilV2): readonly string[] => [
  ...(sigil.futureEffectHints.damageTypes ?? []),
  ...(sigil.futureEffectHints.statuses ?? []),
  ...(sigil.futureEffectHints.fields ?? []),
  ...(sigil.futureEffectHints.fieldInteractions ?? []),
  ...(sigil.futureEffectHints.defense ?? []),
  ...(sigil.futureEffectHints.support ?? []),
  ...(sigil.futureEffectHints.utility ?? []),
].slice(0, 4);

const keyTags = (key: MagicCatalogKeyV2): readonly string[] =>
  key.futureEffectTags.slice(0, 4);

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
          title={`${glyph.display_name} (${glyph.id})`}
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

const CatalogTags = ({ tags }: { readonly tags: readonly string[] }) => {
  if (tags.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded-sm bg-black/25 px-1.5 py-0.5 text-[9px] text-amber-500">
          {tag}
        </span>
      ))}
    </div>
  );
};

const ruleCards = [
  {
    icon: <Circle className="w-4 h-4" />,
    title: "Circulo de conjuracao",
    desc: "Maior circulo externo. Obrigatorio, fechado e sem canais vazando para fora.",
  },
  {
    icon: <Hexagon className="w-4 h-4" />,
    title: "Sigilo central",
    desc: "Define o que a magia e. Contencao melhora estabilidade visual, mas nao e selo separado.",
  },
  {
    icon: <Key className="w-4 h-4" />,
    title: "Chaves",
    desc: "Definem forma, modificador ou acao. Circulo pequeno cria escopo local.",
  },
  {
    icon: <GitBranch className="w-4 h-4" />,
    title: "Canais",
    desc: "Ligue chaves a borda da contencao central. Reta e aceita no centro; entre chaves, use arco.",
  },
];

const tutorialGlyphs = {
  aqua: [getGlyphById("ELEMENT_AQUA")].filter((glyph): glyph is GlyphTemplate => Boolean(glyph)),
  projectile: [getGlyphById("FORM_PROJECTILE")].filter((glyph): glyph is GlyphTemplate => Boolean(glyph)),
};

interface TutorialMandalaExample {
  readonly id: string;
  readonly name: string;
  readonly effect: string;
  readonly elementTemplateId: string;
  readonly elementLabel: string;
  readonly keyTemplateId: string;
  readonly keyLabel: string;
  readonly accent: string;
  readonly keyCenter: {
    readonly x: number;
    readonly y: number;
  };
  readonly channelBend: number;
  readonly playableTutorial?: boolean;
}

const tutorialMandalaExamples: readonly TutorialMandalaExample[] = [
  {
    id: "aqua-projectile",
    name: "Projetil de Aqua",
    effect: "Ataque simples para aprender a formula base.",
    elementTemplateId: "ELEMENT_AQUA",
    elementLabel: "Aqua",
    keyTemplateId: "FORM_PROJECTILE",
    keyLabel: "Projetil",
    accent: "#38bdf8",
    keyCenter: { x: 91, y: 60 },
    channelBend: 0,
    playableTutorial: true,
  },
  {
    id: "terra-shield",
    name: "Escudo de Terra",
    effect: "Defesa basica que transforma Terra em barreira.",
    elementTemplateId: "ELEMENT_TERRA",
    elementLabel: "Terra",
    keyTemplateId: "DEFENSE_SHIELD",
    keyLabel: "Escudo",
    accent: "#d6a86b",
    keyCenter: { x: 60, y: 91 },
    channelBend: 0,
  },
  {
    id: "ventus-bubble",
    name: "Bolha de Ventus",
    effect: "Protecao leve para praticar uma chave lateral.",
    elementTemplateId: "ELEMENT_VENTUS",
    elementLabel: "Ventus",
    keyTemplateId: "FORM_AURA",
    keyLabel: "Bolha",
    accent: "#6ee7b7",
    keyCenter: { x: 31, y: 77 },
    channelBend: -5,
  },
];

function TutorialMandalaPreview({ example }: { readonly example: TutorialMandalaExample }) {
  const elementGlyph = getGlyphById(example.elementTemplateId);
  const keyGlyph = getGlyphById(example.keyTemplateId);
  const center = { x: 60, y: 60 };
  const containmentRadius = 18;
  const keyScopeRadius = 13;
  const dx = example.keyCenter.x - center.x;
  const dy = example.keyCenter.y - center.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const unitX = dx / distance;
  const unitY = dy / distance;
  const channelStart = {
    x: center.x + unitX * containmentRadius,
    y: center.y + unitY * containmentRadius,
  };
  const channelEnd = {
    x: example.keyCenter.x - unitX * keyScopeRadius,
    y: example.keyCenter.y - unitY * keyScopeRadius,
  };
  const channelControl = {
    x: (channelStart.x + channelEnd.x) / 2 - unitY * example.channelBend,
    y: (channelStart.y + channelEnd.y) / 2 + unitX * example.channelBend,
  };

  return (
    <svg
      viewBox="0 0 120 120"
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label={`Mandala de exemplo: ${example.name}`}
    >
      <defs>
        <radialGradient id={`${example.id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={example.accent} stopOpacity="0.2" />
          <stop offset="70%" stopColor={example.accent} stopOpacity="0.04" />
          <stop offset="100%" stopColor={example.accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="57" fill={`url(#${example.id}-glow)`} />
      <circle cx="60" cy="60" r="53" fill="none" stroke={example.accent} strokeWidth="1.8" opacity="0.82" />
      <circle cx="60" cy="60" r="49" fill="none" stroke={example.accent} strokeWidth="0.55" opacity="0.22" />
      <circle
        cx={center.x}
        cy={center.y}
        r={containmentRadius}
        fill="rgba(0,0,0,0.14)"
        stroke={example.accent}
        strokeWidth="1.15"
        opacity="0.78"
      />
      <path
        d={`M ${channelStart.x.toFixed(2)} ${channelStart.y.toFixed(2)} Q ${channelControl.x.toFixed(2)} ${channelControl.y.toFixed(2)} ${channelEnd.x.toFixed(2)} ${channelEnd.y.toFixed(2)}`}
        fill="none"
        stroke={example.accent}
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.78"
      />
      <circle
        cx={example.keyCenter.x}
        cy={example.keyCenter.y}
        r={keyScopeRadius}
        fill="rgba(0,0,0,0.2)"
        stroke={example.accent}
        strokeWidth="1.15"
        opacity="0.82"
      />
      {elementGlyph && (
        <TemplateGlyphMark
          glyph={elementGlyph}
          layoutOverride={{ x: center.x, y: center.y, size: 23 }}
          strokeWidth={2.1}
        />
      )}
      {keyGlyph && (
        <TemplateGlyphMark
          glyph={keyGlyph}
          layoutOverride={{ x: example.keyCenter.x, y: example.keyCenter.y, size: 15 }}
          strokeWidth={2}
        />
      )}
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <circle
            key={`${example.id}-mark-${index}`}
            cx={60 + Math.cos(angle) * 53}
            cy={60 + Math.sin(angle) * 53}
            r="1.15"
            fill={example.accent}
            opacity="0.72"
          />
        );
      })}
    </svg>
  );
}

function TutorialMandalaCard({
  example,
  onStartTutorial,
}: {
  readonly example: TutorialMandalaExample;
  readonly onStartTutorial?: () => void;
}) {
  const steps = [
    example.elementLabel,
    example.keyLabel,
    "Canal",
    "Circulo externo",
  ];

  return (
    <article className="overflow-hidden rounded-lg border border-amber-800/30 bg-black/20">
      <div className="border-b border-amber-900/25 bg-gradient-to-b from-black/10 to-black/30 p-3">
        <TutorialMandalaPreview example={example} />
      </div>
      <div className="space-y-3 p-3">
        <div>
          <p className="text-xs font-bold text-amber-200">{example.name}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-amber-500/80">{example.effect}</p>
        </div>
        <ol className="grid grid-cols-2 gap-1.5">
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-1.5 rounded bg-black/25 px-1.5 py-1 text-[9px] text-amber-300/85">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-700/75 text-[8px] font-bold text-amber-50">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {example.playableTutorial && onStartTutorial && (
          <button
            type="button"
            onClick={onStartTutorial}
            className="w-full rounded border border-sky-700/40 bg-sky-900/30 px-2 py-1.5 text-[10px] font-bold text-sky-100 transition hover:bg-sky-800/45"
          >
            Tracar esta mandala
          </button>
        )}
      </div>
    </article>
  );
}

export function GuidePanelV2({ onClose, initialTab = "rules", onStartTutorial }: GuidePanelProps) {
  const [tab, setTab] = useState<GuideTab>(initialTab);
  const tabs: { readonly id: GuideTab; readonly label: string }[] = [
    { id: "tutorial", label: "Primeira magia" },
    { id: "rules", label: "Regras" },
    { id: "catalog", label: "Catalogo" },
    { id: "channels", label: "Canais" },
    { id: "symmetry", label: "Simetria" },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a0f14] border-2 border-amber-700/60 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-amber-900/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold text-amber-200">Guia da Mandala v2.2</h2>
              <p className="text-[10px] text-amber-600/80">
                {magicCatalogV2.sigils.length} sigilos, {magicCatalogV2.keys.length} chaves, risco {riskLabels[defaultGrimoireLoadout.maxRiskLevel]}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-amber-900/30 rounded-lg transition-colors" title="Fechar">
            <X className="w-5 h-5 text-amber-400" />
          </button>
        </div>

        <div className="flex border-b border-amber-900/30 flex-shrink-0">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === item.id
                  ? "text-amber-300 border-b-2 border-amber-500 bg-amber-900/20"
                  : "text-amber-600 hover:text-amber-400"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {tab === "tutorial" && (
            <section className="space-y-4">
              <div className="rounded-lg border border-sky-800/35 bg-sky-950/25 p-4">
                <p className="text-sm font-bold text-sky-200">Projetil de Aqua</p>
                <p className="mt-1 text-xs text-sky-200/75">
                  O combate fica pausado. No canvas, toda a formula aparece desenhada para voce tracar por cima.
                </p>
              </div>

              <ol className="space-y-3">
                <li className="flex gap-3 rounded-lg border border-amber-900/25 bg-amber-950/25 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-amber-50">1</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-amber-300">Trace Aqua no centro</p>
                    <p className="mb-2 mt-1 text-xs text-amber-300/70">Passe a tinta sobre a gota, a onda e o circulo pequeno ao redor.</p>
                    <BindingGlyphs glyphs={tutorialGlyphs.aqua} />
                  </div>
                </li>
                <li className="flex gap-3 rounded-lg border border-amber-900/25 bg-amber-950/25 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-amber-50">2</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-amber-300">Trace a chave de Projetil</p>
                    <p className="mb-2 mt-1 text-xs text-amber-300/70">Passe sobre a seta e depois sobre o circulo que cria seu escopo.</p>
                    <BindingGlyphs glyphs={tutorialGlyphs.projectile} />
                  </div>
                </li>
                <li className="flex gap-3 rounded-lg border border-amber-900/25 bg-amber-950/25 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-amber-50">3</span>
                  <div>
                    <p className="text-xs font-bold text-amber-300">Trace o canal central</p>
                    <p className="mt-1 text-xs text-amber-300/70">Ligue a borda do circulo de contencao a chave seguindo a reta azul.</p>
                  </div>
                </li>
                <li className="flex gap-3 rounded-lg border border-amber-900/25 bg-amber-950/25 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-amber-50">4</span>
                  <div>
                    <p className="text-xs font-bold text-amber-300">Feche o circulo externo por ultimo</p>
                    <p className="mt-1 text-xs text-amber-300/70">
                      Ao fechar o circulo grande, a formula e enviada imediatamente. Use Desfazer ou Ctrl+Z antes disso para corrigir.
                    </p>
                  </div>
                </li>
              </ol>

              {onStartTutorial && (
                <button
                  type="button"
                  onClick={onStartTutorial}
                  className="w-full rounded-lg border border-sky-700/45 bg-sky-900/35 px-4 py-3 text-sm font-bold text-sky-100 transition hover:bg-sky-800/45"
                >
                  Comecar a tracar
                </button>
              )}
            </section>
          )}

          {tab === "rules" && (
            <section className="space-y-3">
              {ruleCards.map((card) => (
                <div key={card.title} className="flex items-start gap-3 p-3 bg-amber-950/30 rounded-lg border border-amber-900/20">
                  <div className="text-amber-400 mt-0.5">{card.icon}</div>
                  <div>
                    <p className="font-semibold text-amber-300 text-xs mb-0.5">{card.title}</p>
                    <p className="text-xs text-amber-300/70">{card.desc}</p>
                  </div>
                </div>
              ))}
              <div className="p-3 bg-black/25 rounded-lg border border-amber-900/20">
                <p className="text-xs text-amber-300/75">
                  O circulo, os simbolos e suas ligacoes definem o nome, a forca e o efeito da magia.
                </p>
              </div>
            </section>
          )}

          {tab === "catalog" && (
            <section className="space-y-5">
              <div className="space-y-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-amber-400">
                    <Sparkles className="h-4 w-4" /> Mandalas de treino
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-amber-300/65">
                    Copie uma formula completa na ordem indicada. Feche sempre o circulo externo por ultimo para conjurar.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {tutorialMandalaExamples.map((example) => (
                    <TutorialMandalaCard
                      key={example.id}
                      example={example}
                      onStartTutorial={onStartTutorial}
                    />
                  ))}
                </div>
              </div>

              <div className="border-t border-amber-900/30" />

              <p className="rounded-lg border border-amber-900/25 bg-black/20 p-3 text-xs leading-relaxed text-amber-300/70">
                O reconhecedor identifica o desenho visual exato. Glifos diferentes podem
                compilar para a mesma chave; por isso o catalogo mostra todos os desenhos
                vinculados a cada efeito.
              </p>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Hexagon className="w-4 h-4" /> Sigilos
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {magicCatalogV2.sigils.map((sigil) => (
                    <div key={sigil.id} className="rounded-lg border border-amber-900/25 bg-amber-950/25 p-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-amber-300">{sigil.name}</p>
                          <p className="text-[9px] font-mono text-amber-700">{sigil.id} / {sigil.element}</p>
                          <CatalogTags tags={sigilTags(sigil)} />
                        </div>
                      </div>
                      <BindingGlyphs glyphs={glyphsForSigil(sigil.id)} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Key className="w-4 h-4" /> Chaves
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {magicCatalogV2.keys.map((key) => (
                    <div key={key.id} className="rounded-lg border border-amber-900/25 bg-amber-950/25 p-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-amber-300">{key.name}</p>
                          <p className="text-[9px] font-mono text-amber-700">{key.id} / {keyKindLabels[key.kind]}</p>
                          <CatalogTags tags={keyTags(key)} />
                        </div>
                      </div>
                      <BindingGlyphs glyphs={glyphsForKey(key.id)} />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === "channels" && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Target className="w-4 h-4" /> Canais circulares
              </h3>
              <ul className="space-y-2.5 text-xs text-amber-300/70">
                {[
                  `Chave para chave exige curvatura minima ${magicCatalogV2.channelRules.keyToKey.minCurvature}.`,
                  "Canal reto entre chaves invalida a formula visual.",
                  "Do centro para uma chave, ligue a borda da contencao com canal reto ou curvo.",
                  "Qualquer canal que cruza o circulo externo vira vazamento.",
                  "Canal nao e glifo de catalogo; e ligacao estrutural desenhada.",
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "symmetry" && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Scale className="w-4 h-4" /> Score estetico
              </h3>
              <div className="space-y-2">
                {Object.entries(magicCatalogV2.symmetryScoring.components).map(([name, weight]) => (
                  <div key={name} className="flex items-center justify-between rounded-lg border border-amber-900/20 bg-black/20 px-3 py-2">
                    <span className="text-xs text-amber-300">{name}</span>
                    <span className="text-[10px] text-amber-600">{Math.round(weight * 100)}%</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-300/70 flex items-start gap-2">
                <Shield className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                Simetria melhora a forca e o brilho, mas a magia ainda precisa de todas as partes obrigatorias.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
