import type { SpellRecipe } from "@/types/spellCard";

export const spellRecipes: readonly SpellRecipe[] = [
  {
    id: "element_emit_projectile_enemy",
    name: "Projétil Arcano",
    kind: "attack",
    requiredRoles: ["container", "source", "element", "action", "form"],
    optionalRoles: ["target", "ink", "risk", "time"],
    basePower: 24,
    baseInkCost: 4,
    target: "default_enemy",
  },
  {
    id: "earth_contain_barrier_self",
    name: "Círculo de Proteção",
    kind: "defense",
    requiredRoles: ["container", "source", "element", "defense"],
    optionalRoles: ["form", "target", "ink", "time"],
    basePower: 18,
    baseInkCost: 3,
    target: "self",
  },
  {
    id: "restore_self_support",
    name: "Selo Restaurador",
    kind: "support",
    requiredRoles: ["container", "source", "element", "action"],
    optionalRoles: ["target", "form", "ink", "time"],
    basePower: 16,
    baseInkCost: 3,
    target: "self",
  },
];

export const fallbackSpellRecipe: SpellRecipe = {
  id: "improvised_spell_graph",
  name: "Mandala Improvisada",
  kind: "utility",
  requiredRoles: ["container", "source", "element"],
  optionalRoles: ["action", "form", "target", "defense", "time", "risk", "ink"],
  basePower: 10,
  baseInkCost: 2,
  target: "default_enemy",
};
