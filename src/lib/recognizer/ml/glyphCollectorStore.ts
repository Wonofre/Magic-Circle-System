import type { RecognitionStroke } from "@/types/recognition";
import { magicRuneCatalogVersion } from "@/data/magicOntology";
import { glyphModelClassIds } from "@/lib/recognizer/ml/glyphClasses";
import { getGlyphModelRuntimeState } from "@/lib/recognizer/ml/modelRuntime";

export interface GlyphCollectorSample {
  readonly id: string;
  readonly schemaVersion: 1 | 2;
  readonly label: string;
  readonly createdAt: string;
  readonly source: "human";
  readonly catalogVersion?: string;
  readonly modelVersion?: string;
  readonly strokes: readonly RecognitionStroke[];
}

const DATABASE_NAME = "magic-glyph-collector";
const DATABASE_VERSION = 1;
const STORE_NAME = "samples";

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = run(transaction.objectStore(STORE_NAME));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const saveGlyphCollectorSample = async (
  label: string,
  strokes: readonly RecognitionStroke[],
): Promise<GlyphCollectorSample> => {
  if (!glyphModelClassIds.includes(label)) {
    throw new Error(`Cannot collect inactive or unknown glyph label "${label}".`);
  }
  const modelVersion = getGlyphModelRuntimeState().metadata?.modelVersion;
  const sample: GlyphCollectorSample = {
    id: crypto.randomUUID(),
    schemaVersion: 2,
    label,
    createdAt: new Date().toISOString(),
    source: "human",
    catalogVersion: magicRuneCatalogVersion,
    modelVersion,
    strokes: strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    })),
  };
  await withStore("readwrite", (store) => store.put(sample));
  return sample;
};

export const listGlyphCollectorSamples = async (): Promise<readonly GlyphCollectorSample[]> =>
  withStore<GlyphCollectorSample[]>("readonly", (store) => store.getAll());

export const exportGlyphCollectorSamples = async (): Promise<number> => {
  const samples = await listGlyphCollectorSamples();
  const jsonl = samples.map((sample) => JSON.stringify(sample)).join("\n");
  const blob = new Blob([jsonl], { type: "application/x-ndjson;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `glyph-samples-${new Date().toISOString().slice(0, 10)}.jsonl`;
  anchor.click();
  URL.revokeObjectURL(url);
  return samples.length;
};
