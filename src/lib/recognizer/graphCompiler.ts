import type { GlyphSemanticRole, GlyphTemplate } from "@/types/glyphTemplates";
import type { SemanticMarginResult } from "@/types/recognition";
import type {
  SpellGraph,
  SpellGraphCompileIssue,
  SpellGraphCompileOptions,
  SpellGraphCompileResult,
  SpellGraphEdge,
  SpellGraphGlyphInput,
  SpellGraphNode,
  SpellGraphNodeKind,
} from "@/types/spellGraph";

const ROLE_ORDER: readonly GlyphSemanticRole[] = [
  "container",
  "source",
  "connector",
  "element",
  "derived",
  "action",
  "form",
  "defense",
  "time",
  "target",
  "risk",
  "ink",
];

const CONNECTOR_ROLES = new Set<GlyphSemanticRole>(["connector"]);
const OUTPUT_PORT_HINTS = ["out", "output", "exit", "outer", "right", "top"];
const INPUT_PORT_HINTS = ["in", "input", "entry", "inner", "left", "bottom"];
const CASTABLE_OUTCOMES = new Set(["cast_clean", "cast_weak", "partial"]);

const roleToKind = (role: GlyphSemanticRole): SpellGraphNodeKind => {
  switch (role) {
    case "container":
      return "frame";
    case "source":
      return "source";
    case "connector":
      return "connector";
    case "element":
    case "derived":
      return "element";
    case "action":
      return "action";
    case "form":
      return "form";
    case "target":
      return "target";
    case "defense":
      return "defense";
    case "time":
      return "time";
    case "risk":
      return "risk";
    case "ink":
      return "ink";
  }
};

const roleRank = (role: GlyphSemanticRole): number => {
  const index = ROLE_ORDER.indexOf(role);
  return index === -1 ? ROLE_ORDER.length : index;
};

const sortGlyphInputs = (
  inputs: readonly SpellGraphGlyphInput[],
): readonly SpellGraphGlyphInput[] =>
  [...inputs].sort((a, b) => {
    const roleDelta = roleRank(a.template.semantic_role) - roleRank(b.template.semantic_role);
    if (roleDelta !== 0) return roleDelta;
    return a.template.id.localeCompare(b.template.id);
  });

const makeNodeId = (template: GlyphTemplate, index: number): string =>
  `${roleToKind(template.semantic_role)}:${template.id}:${index}`;

const makeNode = (input: SpellGraphGlyphInput, index: number): SpellGraphNode => ({
  id: makeNodeId(input.template, index),
  kind: roleToKind(input.template.semantic_role),
  templateId: input.template.id,
  displayName: input.template.display_name,
  family: input.template.family,
  semanticRole: input.template.semantic_role,
  ports: input.template.ports,
  confidence: input.confidence,
  recognitionOutcome: input.recognitionOutcome,
});

const makeDefaultTargetNode = (): SpellGraphNode => ({
  id: "default_target:enemy:0",
  kind: "default_target",
  templateId: "DEFAULT_TARGET_ENEMY",
  displayName: "Default Enemy Target",
  family: "default",
  semanticRole: "default_target",
  ports: ["in"],
});

const findPort = (ports: readonly string[], hints: readonly string[], fallback: string): string => {
  const match = ports.find((port) => {
    const normalized = port.toLowerCase();
    return hints.some((hint) => normalized.includes(hint));
  });

  return match ?? ports[0] ?? fallback;
};

const canConnect = (from: SpellGraphNode, to: SpellGraphNode): boolean => {
  if (from.kind === "frame") return true;
  if (to.kind === "default_target") return true;
  if (from.ports.length === 0 || to.ports.length === 0) return false;
  return true;
};

const makeEdge = (from: SpellGraphNode, to: SpellGraphNode, index: number): SpellGraphEdge => ({
  id: `edge:${index}:${from.id}->${to.id}`,
  from: from.id,
  to: to.id,
  fromPort: findPort(from.ports, OUTPUT_PORT_HINTS, "out"),
  toPort: findPort(to.ports, INPUT_PORT_HINTS, "in"),
});

const issue = (
  code: string,
  message: string,
  severity: SpellGraphCompileIssue["severity"] = "error",
): SpellGraphCompileIssue => ({
  code,
  message,
  severity,
});

const validateGrammar = (nodes: readonly SpellGraphNode[]): SpellGraphCompileIssue[] => {
  const issues: SpellGraphCompileIssue[] = [];
  const hasRole = (role: SpellGraphNode["semanticRole"]) =>
    nodes.some((node) => node.semanticRole === role);
  const hasKind = (kind: SpellGraphNodeKind) => nodes.some((node) => node.kind === kind);

  if (!hasRole("container")) {
    issues.push(issue("missing_frame", "SpellGraph requires a frame/container glyph."));
  }

  if (!hasRole("source")) {
    issues.push(issue("missing_source", "SpellGraph requires an ink source glyph."));
  }

  if (!hasRole("element") && !hasRole("derived")) {
    issues.push(issue("missing_element", "SpellGraph requires an element glyph."));
  }

  if (!hasRole("action") && !hasRole("form") && !hasKind("defense")) {
    issues.push(
      issue("missing_action_or_form", "SpellGraph requires an action, form, or defense glyph."),
    );
  }

  if (!hasRole("target") && !hasKind("default_target")) {
    issues.push(issue("missing_target", "SpellGraph requires a target or legal default target."));
  }

  return issues;
};

const validateEdges = (
  nodes: readonly SpellGraphNode[],
  edges: readonly SpellGraphEdge[],
): SpellGraphCompileIssue[] => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const issues: SpellGraphCompileIssue[] = [];

  for (const edge of edges) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);

    if (!from || !to || !canConnect(from, to)) {
      issues.push(
        issue(
          "invalid_port_connection",
          `Invalid connection from ${edge.from} to ${edge.to}.`,
        ),
      );
    }
  }

  return issues;
};

const getCanonicalShape = (
  nodes: readonly SpellGraphNode[],
  edges: readonly SpellGraphEdge[],
): string =>
  JSON.stringify({
    version: 1,
    nodes: nodes.map((node) => ({
      kind: node.kind,
      templateId: node.templateId,
      semanticRole: node.semanticRole,
    })),
    edges: edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      fromPort: edge.fromPort,
      toPort: edge.toPort,
    })),
  });

export const createSpellHash = (canonicalShape: string): string => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < canonicalShape.length; index += 1) {
    hash ^= canonicalShape.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `spell_${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

export const semanticResultsToGraphInputs = (
  results: readonly SemanticMarginResult[],
): SpellGraphGlyphInput[] =>
  results
    .filter(
      (result) =>
        result.candidate !== null && CASTABLE_OUTCOMES.has(result.outcome),
    )
    .map((result) => ({
      template: result.candidate!.template,
      confidence: result.confidence,
      recognitionOutcome: result.outcome,
    }));

export const compileSpellGraph = (
  glyphInputs: readonly SpellGraphGlyphInput[],
  options: SpellGraphCompileOptions = {},
): SpellGraphCompileResult => {
  const addDefaultTarget = options.addDefaultTarget ?? true;
  const sortedInputs = options.preserveMandalaOrder ? glyphInputs : sortGlyphInputs(glyphInputs);
  const nodes = sortedInputs.map(makeNode);
  const hasTarget = nodes.some((node) => node.semanticRole === "target");
  const nodesWithDefaultTarget =
    hasTarget || !addDefaultTarget ? nodes : [...nodes, makeDefaultTargetNode()];
  const edges = nodesWithDefaultTarget
    .filter((node) => !CONNECTOR_ROLES.has(node.semanticRole as GlyphSemanticRole))
    .slice(1)
    .map((node, index, connectableNodes) => {
      const previous =
        index === 0
          ? nodesWithDefaultTarget[0]
          : connectableNodes[index - 1];
      return makeEdge(previous, node, index);
    });
  const issues = [
    ...validateGrammar(nodesWithDefaultTarget),
    ...validateEdges(nodesWithDefaultTarget, edges),
  ];

  if (issues.some((entry) => entry.severity === "error")) {
    return {
      ok: false,
      graph: null,
      issues,
    };
  }

  const canonicalShape = getCanonicalShape(nodesWithDefaultTarget, edges);
  const graph: SpellGraph = {
    version: 1,
    nodes: nodesWithDefaultTarget,
    edges,
    spellHash: createSpellHash(canonicalShape),
    canonicalShape,
  };

  return {
    ok: true,
    graph,
    issues,
  };
};
