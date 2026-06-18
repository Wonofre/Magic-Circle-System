import { BookOpen, GitBranch, Shield, Sparkles } from "lucide-react";
import { activeRuneDefinitions } from "@/data/magicOntology";
import { magicCatalogV2 } from "@/data/magicCatalogV2";
import { defaultGrimoireLoadout } from "@/lib/spell/codexStore";
import { riskLabels } from "@/lib/ui/runeCatalogPresentation";
import { workshopBackground } from "@/lib/ui/themeTokens";
import "../App.css";

const knownRunes = activeRuneDefinitions.filter((rune) =>
  defaultGrimoireLoadout.knownGlyphIds.includes(rune.templateId),
);

export default function Home() {
  return (
    <main className="min-h-screen p-6" style={{ background: "#0d0608" }}>
      <div className="wha-scene" aria-hidden="true">
        <div className="wha-scene-bg" style={{ backgroundImage: workshopBackground }} />
        <div className="wha-scene-vignette" />
        <div className="wha-scene-candles" />
      </div>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl flex-col justify-center gap-6 animate-panel-rise">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.28em] text-[#c9a227]/70">Mandala v2.2</p>
          <h1 className="font-display text-3xl font-bold text-[#e8c86a] tracking-wider">Círculo Mágico</h1>
          <p className="max-w-xl text-base text-[#e8d4a8]/70 italic">
            O runtime usa sigilos, chaves, canais circulares e simetria do catálogo v2.2.
            O Codex registra fórmulas por MagicFormulaV2.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="wha-stat-card p-4 text-left">
            <Sparkles className="mb-2 h-5 w-5 text-[#e8c86a]" />
            <p className="text-xs text-[#c9a227]/70 uppercase tracking-wider">Glifos no loadout</p>
            <p className="text-2xl font-bold text-[#e8d4a8] font-mono">{knownRunes.length}</p>
          </div>
          <div className="wha-stat-card p-4 text-left">
            <BookOpen className="mb-2 h-5 w-5 text-[#2d6a8f]" />
            <p className="text-xs text-[#c9a227]/70 uppercase tracking-wider">Sigilos v2.2</p>
            <p className="text-2xl font-bold text-[#e8d4a8] font-mono">{magicCatalogV2.sigils.length}</p>
          </div>
          <div className="wha-stat-card p-4 text-left">
            <Shield className="mb-2 h-5 w-5 text-[#3d8b5a]" />
            <p className="text-xs text-[#c9a227]/70 uppercase tracking-wider">Risco máximo</p>
            <p className="text-2xl font-bold text-[#e8d4a8]">{riskLabels[defaultGrimoireLoadout.maxRiskLevel]}</p>
          </div>
        </div>

        <div className="rounded border border-[#c9a227]/20 bg-[#2a1018]/50 p-4 backdrop-blur-sm">
          <p className="mb-3 text-xs font-semibold text-[#c9a227] uppercase tracking-wider">Catálogo ativo</p>
          <div className="flex flex-wrap gap-2">
            <span className="rune-chip">
              <Sparkles className="h-3 w-3" /> {magicCatalogV2.sigils.length} sigilos
            </span>
            <span className="rune-chip">
              <BookOpen className="h-3 w-3" /> {magicCatalogV2.keys.length} chaves
            </span>
            <span className="rune-chip">
              <GitBranch className="h-3 w-3" /> canais circulares
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}