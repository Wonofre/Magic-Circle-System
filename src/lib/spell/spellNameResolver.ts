import type { SpellRecipe } from "@/types/spellCard";
import type { SpellGraph } from "@/types/spellGraph";

const ELEMENT_ADJECTIVE_BY_TEMPLATE_ID: Readonly<Record<string, string>> = {
  ELEMENT_IGNIS: "Igneo",
  ELEMENT_AQUA: "Aquatico",
  ELEMENT_TERRA: "Terreo",
  ELEMENT_VENTUS: "Ventoso",
  ELEMENT_LUX: "Luminoso",
  DERIVED_GELU: "Glacial",
  ELEMENT_UMBRA: "Umbral",
  DERIVED_FULMEN: "Fulminante",
  ELEMENT_VITA: "Vital",
  ELEMENT_MENS: "Mental",
};

const FORM_NOUN_BY_TEMPLATE_ID: Readonly<Record<string, string>> = {
  FORM_PROJECTILE: "Projetil",
  FORM_BEAM: "Raio",
  FORM_AURA: "Aura",
  FORM_WAVE: "Onda",
  FORM_CHAIN: "Corrente",
  FORM_RAIN: "Chuva",
  DEFENSE_SHIELD: "Escudo",
};

const ACTION_NOUN_BY_TEMPLATE_ID: Readonly<Record<string, string>> = {
  ACTION_CONTAIN: "Contencao",
  ACTION_RESTORE: "Restauracao",
  ACTION_SEAL: "Selo",
  ACTION_EMIT: "Emissao",
};

export const resolveSpellCardName = (graph: SpellGraph, recipe: SpellRecipe): string => {
  const element = graph.nodes.find((node) => node.kind === "element");
  const form = graph.nodes.find((node) => node.kind === "form" || node.kind === "defense");
  const action = graph.nodes.find((node) => node.kind === "action");
  const noun =
    (form ? FORM_NOUN_BY_TEMPLATE_ID[form.templateId] : undefined) ??
    (action ? ACTION_NOUN_BY_TEMPLATE_ID[action.templateId] : undefined);
  const adjective = element ? ELEMENT_ADJECTIVE_BY_TEMPLATE_ID[element.templateId] : undefined;

  if (noun && adjective) return `${noun} ${adjective}`;
  if (noun) return noun;
  if (adjective) return `${recipe.name} ${adjective}`;
  return recipe.name;
};
