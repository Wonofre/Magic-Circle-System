import { useState } from "react";
import { AlertTriangle, Circle, Hexagon, Shield, Sparkles, Target, X } from "lucide-react";
import { activeLegacySigils, activeLegacySigns, getTemplateIdsForActiveLegacySign } from "@/data/activeRuneCatalog";
import { getGlyphById } from "@/data/glyphTemplates";
import { activeRuneDefinitions, getRuneByLegacySigil } from "@/data/magicOntology";
import { fallbackSpellRecipe, spellRecipes } from "@/data/spellRecipes";
import { defaultGrimoireLoadout } from "@/lib/spell/codexStore";
import {
  getGlyphCatalogLine,
  glyphRoleOrder,
  kindLabels,
  riskLabels,
  roleLabels,
  sortGlyphsForCatalog,
  targetLabels,
} from "@/lib/ui/runeCatalogPresentation";
import { PerfectGlyphPreview } from "@/components/PerfectGlyphPreview";
import { GlyphTemplatePreview } from "@/components/GlyphTemplatePreview";
import type { GlyphTemplate } from "@/types/glyphTemplates";
import type { SigilType, SignType } from "@/types/magic";
import type { SpellRecipe } from "@/types/spellCard";

interface GuidePanelProps {
  readonly onClose: () => void;
}

const sigilColors: Record<SigilType, string> = {
  fire: "#e85d3e",
  water: "#3b8dd4",
  earth: "#8b6f47",
  wind: "#7ec8a0",
  light: "#f0d060",
  ice: "#88d4ee",
  shadow: "#9b6bcc",
  thunder: "#e0d020",
  nature: "#44cc66",
  void: "#8866aa",
};

const elementLabels: Record<SigilType, string> = {
  fire: "Ignis",
  water: "Aqua",
  earth: "Terra",
  wind: "Ventus",
  light: "Lux",
  ice: "Gelu",
  shadow: "Umbra",
  thunder: "Fulmen",
  nature: "Vita",
  void: "Vacuus",
};

const legacySignLabel = (sign: SignType): string =>
  sign.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

type Tab = "howto" | "catalog" | "recipes" | "legacy" | "tips";

const knownGlyphs = sortGlyphsForCatalog(
  defaultGrimoireLoadout.knownGlyphIds
    .map((id) => getGlyphById(id))
    .filter((glyph): glyph is GlyphTemplate => Boolean(glyph)),
);

const lockedRuneDefinitions = activeRuneDefinitions.filter(
  (rune) => !defaultGrimoireLoadout.knownGlyphIds.includes(rune.templateId),
);

const recipesInGuide: readonly SpellRecipe[] = [...spellRecipes, fallbackSpellRecipe].filter((recipe) =>
  defaultGrimoireLoadout.allowedRecipeIds.includes(recipe.id),
);

function RecipeRow({ recipe }: { readonly recipe: SpellRecipe }) {
  return (
    <div className="p-3 bg-purple-950/20 border border-purple-900/25 rounded-lg">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs font-semibold text-purple-200">{recipe.name}</p>
        <span className="text-[10px] text-purple-500">
          {kindLabels[recipe.kind]} / tinta {recipe.baseInkCost}
        </span>
      </div>
      <p className="text-[10px] text-purple-300/75">
        alvo: {targetLabels[recipe.target]} / exige {recipe.requiredRoles.map((role) => roleLabels[role]).join(" + ")}
      </p>
      {recipe.optionalRoles && recipe.optionalRoles.length > 0 && (
        <p className="text-[10px] text-purple-500/80 mt-1">
          opcionais: {recipe.optionalRoles.map((role) => roleLabels[role]).join(", ")}
        </p>
      )}
    </div>
  );
}

export function GuidePanel({ onClose }: GuidePanelProps) {
  const [tab, setTab] = useState<Tab>("catalog");

  const tabs: { readonly id: Tab; readonly label: string }[] = [
    { id: "howto", label: "Como" },
    { id: "catalog", label: "Catalogo" },
    { id: "recipes", label: "Receitas" },
    { id: "legacy", label: "Legado" },
    { id: "tips", label: "Regras" },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a0f14] border-2 border-amber-700/60 rounded-lg max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-amber-900/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold text-amber-200">Guia do Backend Magico</h2>
              <p className="text-[10px] text-amber-600/80">
                {knownGlyphs.length} glifos iniciais, risco {riskLabels[defaultGrimoireLoadout.maxRiskLevel]}
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
          {tab === "howto" && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Circle className="w-4 h-4" /> Como a formula compila
              </h3>
              <div className="space-y-3 text-xs text-amber-300/70">
                {[
                  {
                    n: 1,
                    title: "Desenhe a moldura",
                    desc: "A formula precisa de uma moldura reconhecida como container. Sem frame desenhado, o SpellGraph rejeita a magia.",
                  },
                  {
                    n: 2,
                    title: "Adicione glifos de catalogo",
                    desc: "Elementos, derivados, acoes, formas, defesa e alvo sao lidos por templateId e papel semantico.",
                  },
                  {
                    n: 3,
                    title: "Use os defaults seguros",
                    desc: "Fonte, emitir, projetil e alvo inimigo podem ser completados pelo compilador quando faltarem.",
                  },
                  {
                    n: 4,
                    title: "Passe pelo Codex",
                    desc: "O loadout valida glifos conhecidos e limite de risco. Magias aceitas entram no Codex por hash de formula.",
                  },
                ].map((step) => (
                  <div key={step.n} className="flex items-start gap-3 p-3 bg-amber-950/30 rounded-lg border border-amber-900/20">
                    <span className="bg-amber-800/60 text-amber-300 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                      {step.n}
                    </span>
                    <div>
                      <p className="font-semibold text-amber-300 mb-0.5">{step.title}</p>
                      <p>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "catalog" && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Catalogo ativo do loadout
              </h3>
              <p className="text-xs text-amber-300/70">
                Esta lista vem de <span className="font-mono text-amber-300">defaultGrimoireLoadout.knownGlyphIds</span>.
                O backend valida formulas pelos mesmos templates vetoriais mostrados aqui.
              </p>

              <div className="space-y-3">
                {glyphRoleOrder.map((role) => {
                  const glyphs = knownGlyphs.filter((glyph) => glyph.semantic_role === role);
                  if (glyphs.length === 0) return null;

                  return (
                    <div key={role} className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-amber-600">{roleLabels[role]}</p>
                      <div className="grid grid-cols-1 gap-2">
                        {glyphs.map((glyph) => (
                          <div key={glyph.id} className="flex items-start gap-3 p-2.5 bg-amber-950/25 border border-amber-900/25 rounded-lg">
                            <div className="w-16 h-16 rounded-lg bg-black/30 border border-amber-900/30 flex items-center justify-center text-amber-300 flex-shrink-0">
                              <GlyphTemplatePreview glyph={glyph} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-xs font-semibold text-amber-300 truncate">{glyph.display_name}</p>
                                <span className="text-[9px] text-amber-700 font-mono">{glyph.id}</span>
                              </div>
                              <p className="text-[10px] text-amber-500/80 leading-snug">{glyph.description}</p>
                              <p className="text-[10px] text-amber-600/80 mt-1">{getGlyphCatalogLine(glyph)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {lockedRuneDefinitions.length > 0 && (
                <div className="p-3 bg-black/20 border border-amber-900/25 rounded-lg">
                  <p className="text-xs font-bold text-amber-400 mb-2">Fora do loadout inicial</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lockedRuneDefinitions.map((rune) => (
                      <span key={rune.id} className="text-[10px] bg-black/35 text-amber-400/80 px-2 py-0.5 rounded">
                        {rune.name} / {roleLabels[rune.role]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "recipes" && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Target className="w-4 h-4" /> Receitas sintetizadas
              </h3>
              <p className="text-xs text-amber-300/70">
                As receitas equipadas orientam nome, alvo, poder base e custo. O backend ainda permite a receita improvisada quando
                a formula valida pelo grafo.
              </p>
              <div className="space-y-2">
                {recipesInGuide.map((recipe) => (
                  <RecipeRow key={recipe.id} recipe={recipe} />
                ))}
              </div>
            </section>
          )}

          {tab === "legacy" && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Hexagon className="w-4 h-4" /> Ponte legado
              </h3>
              <p className="text-xs text-amber-300/70">
                Sigilos e chaves antigos ainda entram pelo adaptador legado, mas sao convertidos para templateIds do catalogo.
              </p>

              <div className="space-y-2">
                {activeLegacySigils.map((type) => {
                  const rune = getRuneByLegacySigil(type);
                  return (
                    <div
                      key={type}
                      className="flex items-start gap-3 p-3 rounded-lg border transition-colors"
                      style={{
                        background: `${sigilColors[type]}11`,
                        borderColor: `${sigilColors[type]}33`,
                      }}
                    >
                      <div
                        className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 border"
                        style={{
                          background: `${sigilColors[type]}22`,
                          borderColor: `${sigilColors[type]}44`,
                        }}
                      >
                        <PerfectGlyphPreview mode="sigil" type={type} size={50} strokeWidth={4} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold" style={{ color: sigilColors[type] }}>
                          {rune?.name ?? elementLabels[type]}
                        </p>
                        <p className="text-[10px] text-amber-400/80">
                          {type} {"->"} {rune?.templateId ?? "sem mapeamento"} / {rune ? roleLabels[rune.role] : "legado"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-purple-500">Chaves legadas</p>
                {activeLegacySigns.map((type) => {
                  const templateIds = getTemplateIdsForActiveLegacySign(type);
                  return (
                    <div key={type} className="p-2.5 bg-purple-950/20 rounded-lg border border-purple-900/25">
                      <div className="flex items-start gap-2">
                        <div className="w-12 h-12 rounded-lg bg-purple-950/30 border border-purple-800/30 flex items-center justify-center flex-shrink-0">
                          <PerfectGlyphPreview mode="sign" type={type} size={44} strokeWidth={4} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-purple-300">{legacySignLabel(type)}</p>
                          <p className="text-[10px] text-purple-400/70">
                            {templateIds.map((id) => `${id} (${roleLabels[getGlyphById(id)?.semantic_role ?? "action"]})`).join(", ")}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {tab === "tips" && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Regras que importam
              </h3>
              <ul className="space-y-2.5 text-xs text-amber-300/70">
                {[
                  "A moldura desenhada e obrigatoria; a fonte pode ser completada como SOURCE_DOT.",
                  "Se nao houver acao, forma ou alvo, o compilador usa ACTION_EMIT, FORM_PROJECTILE e TARGET_ENEMY.",
                  `O loadout inicial aceita risco ate ${riskLabels[defaultGrimoireLoadout.maxRiskLevel]}; glifos de risco alto podem ser recusados.`,
                  "O Codex registra apenas glifos desenhados como descobertos; defaults seguros nao viram descoberta sozinhos.",
                  "Receitas nao sao uma whitelist dura: o backend marca recipeAllowed, mas a validacao principal e por glifo conhecido e risco.",
                  "Posicoes da mandala afetam estabilidade quando o glifo cai fora da zona esperada.",
                  "Custo de tinta sobe com complexidade, instabilidade e risco; circulos bons reduzem pressao.",
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
