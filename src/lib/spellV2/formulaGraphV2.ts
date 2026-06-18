import { getCatalogKey, getCatalogSigil } from "@/data/magicCatalogV2";
import type { FormulaGraphV2, FormulaGraphNodeV2, MagicFormulaV2 } from "@/types/magicFormulaV2";

const circleLabel = (role: FormulaGraphNodeV2["circleRole"]): string => {
  if (role === "casting_circle") return "Circulo de conjuracao";
  if (role === "sigil_containment") return "Contencao de sigilo";
  return "Escopo de chave";
};

const makeCanonicalShape = (formula: MagicFormulaV2): string =>
  JSON.stringify({
    version: 2,
    circles: [
      formula.castingCircle && [formula.castingCircle.id, formula.castingCircle.role],
      formula.sigilContainment && [formula.sigilContainment.id, formula.sigilContainment.role],
      ...formula.keyScopeCircles.map((circle) => [circle.id, circle.role]),
    ].filter(Boolean),
    sigils: formula.sigils.map((sigil) => [sigil.id, sigil.sigilId, sigil.templateId]),
    keys: formula.keys.map((key) => [key.id, key.keyId, key.scope, key.templateId]),
    channels: formula.channels.map((channel) => [
      channel.id,
      channel.kind,
      channel.fromId,
      channel.toId,
      channel.geometry,
    ]),
  });

export const buildFormulaGraphV2 = (formula: MagicFormulaV2): FormulaGraphV2 => {
  const circleNodes: FormulaGraphNodeV2[] = [
    ...(formula.castingCircle ? [formula.castingCircle] : []),
    ...(formula.sigilContainment ? [formula.sigilContainment] : []),
    ...formula.keyScopeCircles,
  ].map((circle) => ({
    id: circle.id,
    kind: "circle",
    label: circleLabel(circle.role),
    circleRole: circle.role,
    center: circle.center,
    confidence: circle.quality,
  }));

  const sigilNodes: FormulaGraphNodeV2[] = formula.sigils.map((sigil) => ({
    id: sigil.id,
    kind: "sigil",
    label: getCatalogSigil(sigil.sigilId).name,
    templateId: sigil.templateId,
    sigilId: sigil.sigilId,
    center: sigil.center,
    confidence: sigil.confidence,
  }));

  const keyNodes: FormulaGraphNodeV2[] = formula.keys.map((key) => ({
    id: key.id,
    kind: "key",
    label: getCatalogKey(key.keyId).name,
    templateId: key.templateId,
    keyId: key.keyId,
    scope: key.scope,
    center: key.center,
    confidence: key.confidence,
  }));

  return {
    version: 2,
    nodes: [...circleNodes, ...sigilNodes, ...keyNodes],
    edges: formula.channels.map((channel) => ({
      id: channel.id,
      kind: channel.kind,
      fromId: channel.fromId,
      toId: channel.toId,
      geometry: channel.geometry,
      quality: channel.quality,
    })),
    formulaHash: formula.formulaHash,
    canonicalShape: makeCanonicalShape(formula),
  };
};
