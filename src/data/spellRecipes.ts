import type { SpellRecipe } from "@/types/spellCard";

export const spellRecipes: readonly SpellRecipe[] = [
  {
    id: "projectile_visual_formula",
    name: "Projetil Mandalico",
    kind: "attack",
    requiredRoles: ["container", "element", "form"],
    optionalRoles: ["action", "defense", "risk", "time"],
    basePower: 18,
    baseInkCost: 3,
  },
  {
    id: "field_visual_formula",
    name: "Campo Mandalico",
    kind: "control",
    requiredRoles: ["container", "element", "form"],
    optionalRoles: ["action", "time"],
    basePower: 14,
    baseInkCost: 4,
  },
  {
    id: "shield_visual_formula",
    name: "Defesa Circular",
    kind: "defense",
    requiredRoles: ["container", "element", "defense"],
    optionalRoles: ["form", "time"],
    basePower: 16,
    baseInkCost: 3,
  },
];

export const fallbackSpellRecipe: SpellRecipe = {
  id: "improvised_formula_v2",
  name: "Mandala Improvisada",
  kind: "utility",
  requiredRoles: ["container", "element"],
  optionalRoles: ["action", "form", "defense", "time", "risk", "ink"],
  basePower: 10,
  baseInkCost: 2,
};
