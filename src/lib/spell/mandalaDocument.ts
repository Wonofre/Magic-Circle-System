import { getRuneByTemplateId } from "@/data/magicOntology";
import { createMandalaHash } from "@/lib/spell/mandalaHash";
import type { SemanticMarginResult } from "@/types/recognition";
import type {
  CircleQuality,
  MandalaDocument,
  MandalaDocumentSource,
  MandalaSymbol,
  MandalaSymbolPosition,
} from "@/types/mandala";
import type { SpellGraph } from "@/types/spellGraph";

export const FALLBACK_CIRCLE_QUALITY = {
  closure: 100,
  roundness: 100,
  centeredness: 100,
  smoothness: 100,
  overall: 100,
} as const;

export interface MandalaSymbolContext {
  readonly sourceStrokeIds?: readonly string[];
  readonly position?: MandalaSymbolPosition;
}

export interface MandalaDocumentBuildContext {
  readonly circleQuality?: CircleQuality;
  readonly symbolsByTemplateId?: ReadonlyMap<string, readonly MandalaSymbolContext[]>;
}

const isDefaultedSemanticResult = (result: SemanticMarginResult): boolean =>
  result.reasons.some((reason) => reason.code === "spellgraph_safe_default");

const getFormulaName = (templateId: string, fallback: string): string =>
  getRuneByTemplateId(templateId)?.name ?? fallback;

const makeSemanticQueues = (
  semanticResults: readonly SemanticMarginResult[],
): Map<string, SemanticMarginResult[]> => {
  const queues = new Map<string, SemanticMarginResult[]>();

  for (const result of semanticResults) {
    const templateId = result.candidate?.template.id;
    if (!templateId) continue;

    const queue = queues.get(templateId);
    if (queue) {
      queue.push(result);
    } else {
      queues.set(templateId, [result]);
    }
  }

  return queues;
};

export const buildMandalaDocumentFromSemanticResults = ({
  graph,
  semanticResults,
  source = "freehand",
  context,
}: {
  readonly graph: SpellGraph;
  readonly semanticResults: readonly SemanticMarginResult[];
  readonly source?: MandalaDocumentSource;
  readonly context?: MandalaDocumentBuildContext;
}): MandalaDocument => {
  const semanticQueues = makeSemanticQueues(semanticResults);
  const contextQueues = new Map(
    [...(context?.symbolsByTemplateId ?? new Map<string, readonly MandalaSymbolContext[]>()).entries()]
      .map(([templateId, values]) => [templateId, [...values]]),
  );
  const formulaNames: string[] = [];
  const symbols: MandalaSymbol[] = [];

  for (const node of graph.nodes) {
    if (node.semanticRole === "default_target") continue;

    const queue = semanticQueues.get(node.templateId);
    const semantic = queue?.shift();
    const contextQueue = contextQueues.get(node.templateId);
    const symbolContext = contextQueue?.shift();
    const isDefault = semantic ? isDefaultedSemanticResult(semantic) : node.family === "default";

    formulaNames.push(getFormulaName(node.templateId, node.displayName));
    symbols.push({
      id: `symbol:${symbols.length}:${node.templateId}`,
      templateId: node.templateId,
      role: node.semanticRole,
      isDrawn: !isDefault,
      isDefault,
      sourceStrokeIds: isDefault ? [] : symbolContext?.sourceStrokeIds ?? [],
      confidence: semantic?.confidence ?? node.confidence ?? 1,
      position: isDefault ? undefined : symbolContext?.position,
    });
  }

  const formulaReading = formulaNames.join(" -> ");
  const documentWithoutHash = {
    version: 1,
    source,
    circleQuality: context?.circleQuality ?? FALLBACK_CIRCLE_QUALITY,
    symbols,
    formulaReading,
  } as const;

  return {
    ...documentWithoutHash,
    mandalaHash: createMandalaHash(documentWithoutHash),
  };
};
