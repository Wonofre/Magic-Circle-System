import { candidateTemplateSignature } from "@/lib/recognizerV2/scoreFusion";
import type { ParsedMandalaV2 } from "@/lib/recognizerV2/mandalaParserV2";

export const getCandidateTopologySignature = (parsed: ParsedMandalaV2): string => {
  const templates = candidateTemplateSignature([
    ...parsed.sigils.map((sigil) => sigil.templateId),
    ...parsed.keys.map((key) => key.templateId),
    ...(parsed.castingCircle ? ["__casting_circle__"] : []),
  ]);

  const topology = [
    parsed.sigilContainment ? `containment:${parsed.sigilContainment.id}` : "",
    ...parsed.keyScopeCircles.map((circle) => `scope:${circle.id}`),
    ...parsed.channels.map(
      (channel) =>
        `ch:${channel.kind}:${channel.geometry}:${channel.fromId}->${channel.toId}`,
    ),
  ].filter(Boolean);

  return topology.length > 0
    ? `${templates}::${topology.sort().join("|")}`
    : templates;
};