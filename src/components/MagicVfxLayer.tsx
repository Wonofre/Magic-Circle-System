import type { CastResult } from "@/lib/spellEngine";
import type { CSSProperties } from "react";
import { createSpellVfxRecipe } from "@/lib/ui/spellVfxRecipes";
import { PerfectGlyphPreview } from "@/components/PerfectGlyphPreview";

type VfxCastResult = CastResult & { readonly spellHash?: string };

interface MagicVfxLayerProps {
  readonly result: VfxCastResult | null;
}

export function MagicVfxLayer({ result }: MagicVfxLayerProps) {
  if (!result) return null;

  const recipe = createSpellVfxRecipe(result);
  const particles = Array.from({ length: recipe.particleCount }, (_, index) => {
    const angle = (index / recipe.particleCount) * Math.PI * 2 + recipe.rotation;
    const radius = 34 + (index % 5) * 9;
    return {
      id: `${recipe.spellHash}-${index}`,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
      delay: `${index * 34}ms`,
    };
  });

  return (
    <div className="magic-vfx-layer" aria-hidden="true">
      <div
        className={`magic-vfx-core magic-vfx-${recipe.motion} magic-vfx-${recipe.intensity} magic-vfx-target-${recipe.targetLane}`}
        style={{
          "--vfx-color": recipe.color,
          "--vfx-wash": recipe.wash,
          "--vfx-rotation": `${recipe.rotation}deg`,
        } as CSSProperties}
      >
        {recipe.element !== "neutral" && (
          <div className="magic-vfx-glyph">
            <PerfectGlyphPreview
              mode="spell"
              sigils={[recipe.element]}
              signs={[]}
              size={170}
              strokeWidth={4}
            />
          </div>
        )}
        {Array.from({ length: recipe.ringCount }, (_, index) => (
          <span
            key={`${recipe.spellHash}-ring-${index}`}
            className="magic-vfx-ring"
            style={{ animationDelay: `${index * 95}ms` }}
          />
        ))}
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="magic-vfx-particle"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animationDelay: particle.delay,
            }}
          />
        ))}
      </div>
    </div>
  );
}
