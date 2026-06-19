import type {
  RecognitionCandidateSource,
  VisionGlyphCandidate,
  VisionModelStatus,
} from "@/types/recognition";
import {
  DEFAULT_GLYPH_RASTER_LINE_WIDTH,
  DEFAULT_GLYPH_RASTER_PADDING,
  DEFAULT_GLYPH_RASTER_SIZE,
} from "@/lib/recognizer/ml/rasterizeGlyph";
import {
  getRuneByTemplateId,
  magicRuneCatalogVersion,
} from "@/data/magicOntology";
import {
  glyphModelClassIds,
  glyphModelOutputClassIds,
} from "@/lib/recognizer/ml/glyphClasses";

interface OrtTensor {
  readonly data: ArrayLike<number>;
}

interface OrtSession {
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>;
}

interface OrtModule {
  readonly env: {
    readonly wasm: {
      wasmPaths?: {
        readonly wasm: string;
      };
      numThreads?: number;
    };
  };
  readonly Tensor: new (
    type: "float32",
    data: Float32Array,
    dims: readonly number[],
  ) => unknown;
  readonly InferenceSession: {
    create(
      modelUrl: string,
      options: {
        readonly executionProviders: readonly string[];
        readonly graphOptimizationLevel?: "all";
      },
    ): Promise<OrtSession>;
  };
}

export interface GlyphModelMetadata {
  readonly schemaVersion: 1;
  readonly modelVersion: string;
  readonly modelFile: string;
  readonly classes: readonly string[];
  readonly catalogVersion: string;
  readonly classManifestSha256: string;
  readonly classBindings: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly unknownClass: "UNKNOWN";
  readonly input: {
    readonly width: number;
    readonly height: number;
    readonly channels: 1;
    readonly padding: number;
    readonly lineWidth: number;
    readonly mean: number;
    readonly std: number;
  };
  readonly temperature: number;
  readonly classThresholds: Readonly<Record<string, number>>;
  readonly minimumSemanticMargin: number;
  readonly metrics: {
    readonly top1Accuracy: number;
    readonly top3Accuracy: number;
    readonly unknownFalseAcceptRate: number;
  };
  readonly trainingProvenance: {
    readonly datasetSchemaVersion: 2;
    readonly generationSpecSha256: string;
    readonly trainSha256: string;
    readonly valSha256: string;
    readonly testSha256: string;
  };
  readonly sha256: string;
}

export interface GlyphModelRuntimeState {
  readonly status: VisionModelStatus;
  readonly provider?: "webgpu" | "wasm";
  readonly source?: RecognitionCandidateSource;
  readonly metadata?: GlyphModelMetadata;
  readonly error?: string;
}

interface LoadedGlyphModel {
  readonly ort: OrtModule;
  readonly session: OrtSession;
  readonly metadata: GlyphModelMetadata;
  readonly provider: "webgpu" | "wasm";
}

const baseUrl = import.meta.env.BASE_URL;
const modelRoot = `${baseUrl}models/glyph-recognizer-v1/`;
const metadataUrl = `${modelRoot}metadata.json`;
const ortWasmUrl = `${baseUrl}ort/ort-wasm-simd-threaded.wasm`;
const ortJsepWasmUrl = `${baseUrl}ort/ort-wasm-simd-threaded.jsep.wasm`;

let runtimeState: GlyphModelRuntimeState = { status: "idle" };
let loadPromise: Promise<LoadedGlyphModel> | null = null;
const runtimeListeners = new Set<(state: GlyphModelRuntimeState) => void>();

const setRuntimeState = (nextState: GlyphModelRuntimeState) => {
  runtimeState = nextState;
  runtimeListeners.forEach((listener) => listener(runtimeState));
};

export const subscribeGlyphModelRuntimeState = (
  listener: (state: GlyphModelRuntimeState) => void,
): (() => void) => {
  runtimeListeners.add(listener);
  listener(runtimeState);
  return () => {
    runtimeListeners.delete(listener);
  };
};

const isFiniteProbability = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

const sameStringArray = (
  first: readonly string[],
  second: readonly string[],
): boolean =>
  first.length === second.length &&
  first.every((value, index) => value === second[index]);

export const validateGlyphModelMetadata = (value: unknown): GlyphModelMetadata => {
  const metadata = value as Partial<GlyphModelMetadata>;
  if (
    metadata.schemaVersion !== 1 ||
    !metadata.modelVersion ||
    !metadata.modelFile ||
    !Array.isArray(metadata.classes) ||
    !sameStringArray(metadata.classes, glyphModelOutputClassIds) ||
    metadata.catalogVersion !== magicRuneCatalogVersion ||
    !metadata.classManifestSha256?.match(/^[a-f0-9]{64}$/) ||
    !metadata.classBindings ||
    metadata.unknownClass !== "UNKNOWN" ||
    metadata.classes.at(-1) !== metadata.unknownClass ||
    !metadata.input ||
    metadata.input.width !== DEFAULT_GLYPH_RASTER_SIZE ||
    metadata.input.height !== DEFAULT_GLYPH_RASTER_SIZE ||
    metadata.input.padding !== DEFAULT_GLYPH_RASTER_PADDING ||
    metadata.input.lineWidth !== DEFAULT_GLYPH_RASTER_LINE_WIDTH ||
    metadata.input.channels !== 1 ||
    !Number.isFinite(metadata.input.mean) ||
    !Number.isFinite(metadata.input.std) ||
    metadata.input.std <= 0 ||
    typeof metadata.temperature !== "number" ||
    !Number.isFinite(metadata.temperature) ||
    metadata.temperature <= 0 ||
    !metadata.classThresholds ||
    typeof metadata.minimumSemanticMargin !== "number" ||
    !Number.isFinite(metadata.minimumSemanticMargin) ||
    metadata.minimumSemanticMargin < 0 ||
    metadata.minimumSemanticMargin > 1 ||
    !metadata.metrics ||
    !isFiniteProbability(metadata.metrics.top1Accuracy) ||
    !isFiniteProbability(metadata.metrics.top3Accuracy) ||
    !isFiniteProbability(metadata.metrics.unknownFalseAcceptRate) ||
    !metadata.trainingProvenance ||
    metadata.trainingProvenance.datasetSchemaVersion !== 2 ||
    !metadata.trainingProvenance.generationSpecSha256?.match(/^[a-f0-9]{64}$/) ||
    !metadata.trainingProvenance.trainSha256?.match(/^[a-f0-9]{64}$/) ||
    !metadata.trainingProvenance.valSha256?.match(/^[a-f0-9]{64}$/) ||
    !metadata.trainingProvenance.testSha256?.match(/^[a-f0-9]{64}$/) ||
    !metadata.sha256?.match(/^[a-f0-9]{64}$/)
  ) {
    throw new Error("Invalid glyph model metadata.");
  }

  const thresholdIds = Object.keys(metadata.classThresholds);
  if (
    !sameStringArray(thresholdIds, metadata.classes) ||
    !thresholdIds.every((classId) =>
      isFiniteProbability(metadata.classThresholds?.[classId]))
  ) {
    throw new Error("Glyph model thresholds do not match metadata classes.");
  }

  const bindingIds = Object.keys(metadata.classBindings);
  if (!sameStringArray(bindingIds, glyphModelClassIds)) {
    throw new Error("Glyph model bindings do not match active model classes.");
  }
  for (const classId of glyphModelClassIds) {
    const runtimeBinding = getRuneByTemplateId(classId)?.binding;
    const modelBinding = metadata.classBindings[classId];
    if (
      !runtimeBinding ||
      runtimeBinding.type === "casting_circle" ||
      !modelBinding ||
      modelBinding.type !== runtimeBinding.type ||
      (runtimeBinding.type === "sigil" &&
        modelBinding.sigilId !== runtimeBinding.sigilId) ||
      (runtimeBinding.type === "key" &&
        modelBinding.keyId !== runtimeBinding.keyId)
    ) {
      throw new Error(`Glyph model binding for "${classId}" is stale.`);
    }
  }

  return metadata as GlyphModelMetadata;
};

const loadOrt = async (
  provider: "webgpu" | "wasm",
): Promise<OrtModule> => {
  const ort = provider === "webgpu"
    ? await import("onnxruntime-web/webgpu") as OrtModule
    : await import("onnxruntime-web/wasm") as OrtModule;
  ort.env.wasm.wasmPaths = {
    wasm: provider === "webgpu" ? ortJsepWasmUrl : ortWasmUrl,
  };
  ort.env.wasm.numThreads =
    typeof crossOriginIsolated !== "undefined" && crossOriginIsolated ? 2 : 1;
  return ort;
};

const canUseWebGpu = (): boolean =>
  typeof navigator !== "undefined" && "gpu" in navigator;

const createSession = async (
  metadata: GlyphModelMetadata,
  provider: "webgpu" | "wasm",
): Promise<LoadedGlyphModel> => {
  const ort = await loadOrt(provider);
  const session = await ort.InferenceSession.create(
    `${modelRoot}${metadata.modelFile}`,
    {
      executionProviders: [provider],
      graphOptimizationLevel: "all",
    },
  );

  return { ort, session, metadata, provider };
};

const loadModel = async (): Promise<LoadedGlyphModel> => {
  setRuntimeState({ status: "loading" });
  const response = await fetch(metadataUrl);
  if (!response.ok) {
    throw new Error(`Glyph model metadata returned HTTP ${response.status}.`);
  }
  const metadata = validateGlyphModelMetadata(await response.json());

  if (canUseWebGpu()) {
    try {
      const loaded = await createSession(metadata, "webgpu");
      setRuntimeState({
        status: "ready",
        provider: "webgpu",
        source: "onnx_webgpu",
        metadata,
      });
      return loaded;
    } catch {
      // WASM remains the compatibility path when WebGPU initialization fails.
    }
  }

  const loaded = await createSession(metadata, "wasm");
  setRuntimeState({
    status: "ready",
    provider: "wasm",
    source: "onnx_wasm",
    metadata,
  });
  return loaded;
};

const getModel = async (): Promise<LoadedGlyphModel> => {
  if (!loadPromise) {
    loadPromise = loadModel().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setRuntimeState({ status: "unavailable", error: message });
      loadPromise = null;
      throw error;
    });
  }

  return loadPromise;
};

const softmax = (
  logits: ArrayLike<number>,
  temperature: number,
): readonly number[] => {
  const safeTemperature = Math.max(0.05, temperature);
  const scaled = Array.from(logits, (value) => value / safeTemperature);
  const maximum = Math.max(...scaled);
  const exponentials = scaled.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / Math.max(Number.EPSILON, total));
};

export const getGlyphModelRuntimeState = (): GlyphModelRuntimeState => runtimeState;

export const resetGlyphModelRuntimeForTests = () => {
  setRuntimeState({ status: "idle" });
  loadPromise = null;
};

export const preloadGlyphModel = async (): Promise<GlyphModelRuntimeState> => {
  try {
    const model = await getModel();
    const empty = new Float32Array(
      model.metadata.input.width * model.metadata.input.height,
    );
    await runGlyphModel(empty);
  } catch {
    // Callers inspect the returned state and the deterministic matcher remains available.
  }
  return runtimeState;
};

export const runGlyphModel = async (
  raster: Float32Array,
  topK = 5,
): Promise<{
  readonly candidates: readonly VisionGlyphCandidate[];
  readonly provider: "webgpu" | "wasm";
  readonly modelVersion: string;
}> => {
  const model = await getModel();
  const { input, classes, classThresholds, minimumSemanticMargin } = model.metadata;
  if (raster.length !== input.width * input.height) {
    throw new Error(
      `Glyph raster has ${raster.length} values; expected ${input.width * input.height}.`,
    );
  }
  const normalized = Float32Array.from(
    raster,
    (value) => (value - input.mean) / Math.max(0.0001, input.std),
  );
  const inputTensor = new model.ort.Tensor(
    "float32",
    normalized,
    [1, 1, input.height, input.width],
  );
  const inputName = model.session.inputNames[0];
  const outputName = model.session.outputNames[0];
  if (!inputName || !outputName) {
    throw new Error("Glyph model does not expose an input/output tensor.");
  }
  const outputs = await model.session.run({ [inputName]: inputTensor });
  const logits = outputs[outputName]?.data;
  if (!logits || logits.length !== classes.length) {
    throw new Error("Glyph model output does not match metadata classes.");
  }

  const probabilities = softmax(logits, model.metadata.temperature);
  const ranked = probabilities
    .map((confidence, index) => ({
      templateId: classes[index],
      confidence,
    }))
    .sort((first, second) =>
      second.confidence - first.confidence ||
      first.templateId.localeCompare(second.templateId),
    );
  const source = model.provider === "webgpu" ? "onnx_webgpu" : "onnx_wasm";

  return {
    candidates: ranked.slice(0, topK).map((candidate, index) => {
      const nextConfidence = ranked[index + 1]?.confidence ?? 0;
      const semanticMargin = candidate.confidence - nextConfidence;
      const threshold = classThresholds[candidate.templateId] ?? 0.5;
      const passesConfidenceThreshold = candidate.confidence >= threshold;
      const passesSemanticMarginThreshold =
        semanticMargin >= minimumSemanticMargin;
      return {
        ...candidate,
        rank: index + 1,
        semanticMargin,
        confidenceThreshold: threshold,
        semanticMarginThreshold: minimumSemanticMargin,
        passesConfidenceThreshold,
        passesSemanticMarginThreshold,
        source,
        acceptedByClassThreshold:
          candidate.templateId !== model.metadata.unknownClass &&
          passesConfidenceThreshold &&
          passesSemanticMarginThreshold,
      };
    }),
    provider: model.provider,
    modelVersion: model.metadata.modelVersion,
  };
};
