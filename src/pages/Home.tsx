import { BookOpen, Shield, Sparkles } from "lucide-react";
import { activeRuneDefinitions } from "@/data/magicOntology";
import { defaultGrimoireLoadout } from "@/lib/spell/codexStore";
import { riskLabels, roleLabels } from "@/lib/ui/runeCatalogPresentation";
import "../App.css";

const knownRunes = activeRuneDefinitions.filter((rune) =>
  defaultGrimoireLoadout.knownGlyphIds.includes(rune.templateId),
);

const defaultableRunes = activeRuneDefinitions.filter((rune) => rune.canBeDefaulted);

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0508] text-amber-100 p-6">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl flex-col justify-center gap-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-600">SpellGraph + Codex</p>
          <h1 className="text-3xl font-bold text-amber-200">Circulo Magico</h1>
          <p className="max-w-xl text-sm text-amber-400/75">
            Tela sincronizada com o backend: o catalogo inicial vem do loadout, as formulas sao validadas por
            templateId e o Codex registra magias por hash.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-amber-900/35 bg-amber-950/25 p-4">
            <Sparkles className="mb-2 h-5 w-5 text-amber-400" />
            <p className="text-xs text-amber-500">Glifos conhecidos</p>
            <p className="text-2xl font-bold text-amber-200">{knownRunes.length}</p>
          </div>
          <div className="rounded-lg border border-amber-900/35 bg-amber-950/25 p-4">
            <BookOpen className="mb-2 h-5 w-5 text-sky-300" />
            <p className="text-xs text-amber-500">Defaults seguros</p>
            <p className="text-2xl font-bold text-amber-200">{defaultableRunes.length}</p>
          </div>
          <div className="rounded-lg border border-amber-900/35 bg-amber-950/25 p-4">
            <Shield className="mb-2 h-5 w-5 text-emerald-300" />
            <p className="text-xs text-amber-500">Risco maximo</p>
            <p className="text-2xl font-bold text-amber-200">{riskLabels[defaultGrimoireLoadout.maxRiskLevel]}</p>
          </div>
        </div>

        <div className="rounded-lg border border-amber-900/30 bg-black/20 p-4">
          <p className="mb-3 text-xs font-semibold text-amber-400">Papeis ativos no backend</p>
          <div className="flex flex-wrap gap-2">
            {[...new Set(knownRunes.map((rune) => rune.role))].map((role) => (
              <span key={role} className="rounded bg-amber-950/50 px-2 py-1 text-[10px] text-amber-300">
                {roleLabels[role]}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
