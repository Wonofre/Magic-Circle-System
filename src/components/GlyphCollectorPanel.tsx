import { useEffect, useState } from "react";
import { Database, Download, Save } from "lucide-react";

import { magicRuneCatalogVersion } from "@/data/magicOntology";
import { glyphModelClassIds } from "@/lib/recognizer/ml/glyphClasses";
import {
  exportGlyphCollectorSamples,
  listGlyphCollectorSamples,
  saveGlyphCollectorSample,
} from "@/lib/recognizer/ml/glyphCollectorStore";
import {
  getRuneBindingLabel,
  getRuneNameForTemplate,
} from "@/lib/ui/runeCatalogPresentation";
import type { RecognitionStroke } from "@/types/recognition";

interface GlyphCollectorPanelProps {
  readonly strokes: readonly RecognitionStroke[];
}

export function GlyphCollectorPanel({ strokes }: GlyphCollectorPanelProps) {
  const [label, setLabel] = useState(glyphModelClassIds[0] ?? "");
  const [sampleCount, setSampleCount] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void listGlyphCollectorSamples().then((samples) => setSampleCount(samples.length));
  }, []);

  const save = async () => {
    if (!label || strokes.length === 0) return;
    await saveGlyphCollectorSample(label, strokes);
    setSampleCount((count) => count + 1);
    setMessage(`Amostra rotulada como ${label}.`);
  };

  const exportSamples = async () => {
    const count = await exportGlyphCollectorSamples();
    setMessage(`${count} amostra(s) exportadas em JSONL.`);
  };

  return (
    <section className="mt-3 rounded-lg border border-sky-900/35 bg-sky-950/20 p-3 text-left">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-900">
          <Database className="h-3.5 w-3.5" />
          Laboratorio de glifos
        </p>
        <span className="text-[10px] text-sky-900/70">{sampleCount} locais</span>
      </div>
      <p className="mb-2 text-[11px] leading-relaxed text-sky-950/70">
        Desenhe apenas um glifo, escolha o rotulo visual correto e salve. Os dados
        ficam neste navegador ate serem exportados. Catalogo {magicRuneCatalogVersion}.
      </p>
      <select
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        className="w-full rounded border border-sky-900/30 bg-[#f4e2b8] px-2 py-1.5 text-xs text-[#382316]"
      >
        {glyphModelClassIds.map((templateId) => (
          <option key={templateId} value={templateId}>
            {getRuneNameForTemplate(templateId)} - {getRuneBindingLabel(templateId)} [{templateId}]
          </option>
        ))}
      </select>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={strokes.length === 0}
          className="flex items-center justify-center gap-1.5 rounded border border-sky-900/30 px-2 py-1.5 text-xs font-semibold text-sky-950 disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          Salvar rotulo
        </button>
        <button
          type="button"
          onClick={() => void exportSamples()}
          disabled={sampleCount === 0}
          className="flex items-center justify-center gap-1.5 rounded border border-sky-900/30 px-2 py-1.5 text-xs font-semibold text-sky-950 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar JSONL
        </button>
      </div>
      {message && <p className="mt-2 text-[10px] text-sky-900">{message}</p>}
    </section>
  );
}
