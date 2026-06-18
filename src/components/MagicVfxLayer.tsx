import { useMemo } from "react";
import type { CastResult } from "@/lib/spellEngine";
import type { CSSProperties } from "react";
import { createSpellVfxRecipe } from "@/lib/ui/spellVfxRecipes";
import { getVfxTextureSet } from "@/lib/ui/vfxAssets";
import type { MagicPointV2 } from "@/types/magicFormulaV2";

type VfxCastResult = CastResult & { readonly spellHash?: string };

interface MagicVfxLayerProps {
  readonly result: VfxCastResult | null;
}

const projectFormulaPoint = (result: VfxCastResult, point: MagicPointV2) => {
  const circle = result.formula?.castingCircle;
  if (!circle) return { x: 50, y: 50 };
  const scale = 42 / Math.max(1, circle.radius);
  return {
    x: 50 + (point.x - circle.center.x) * scale,
    y: 50 + (point.y - circle.center.y) * scale,
  };
};

const buildParticles = (
  recipe: ReturnType<typeof createSpellVfxRecipe>,
  kind: "particle" | "spark",
) => {
  const base = kind === "spark" ? recipe.sparkCount : recipe.particleCount;
  return Array.from({ length: base }, (_, index) => {
    const angle = (index / base) * Math.PI * 2 + recipe.rotation * (Math.PI / 180);
    const radius = kind === "spark"
      ? 22 + (index % 4) * 7
      : 30 + (index % 6) * 11;
    const size = kind === "spark"
      ? 3 + (index % 3)
      : 5 + (index % 4);
    return {
      id: `${recipe.spellHash}-${kind}-${index}`,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
      size,
      delay: `${index * (kind === "spark" ? 28 : 42)}ms`,
      driftX: Math.cos(angle + 0.4) * (kind === "spark" ? 18 : 28),
      driftY: Math.sin(angle + 0.4) * (kind === "spark" ? 18 : 28),
    };
  });
};

export function MagicVfxLayer({ result }: MagicVfxLayerProps) {
  const recipe = useMemo(
    () => (result ? createSpellVfxRecipe(result) : null),
    [result],
  );

  if (!result || !recipe) return null;

  const formula = result.formula;
  const entityCenters = formula
    ? new Map<string, MagicPointV2>([
        ...formula.sigils.map((sigil) => [sigil.id, sigil.center] as const),
        ...formula.keys.map((key) => [key.id, key.center] as const),
        ...(formula.sigilContainment ? [[formula.sigilContainment.id, formula.sigilContainment.center] as const] : []),
      ])
    : new Map<string, MagicPointV2>();

  const particles = buildParticles(recipe, "particle");
  const sparks = buildParticles(recipe, "spark");
  const textures = getVfxTextureSet(recipe.element, recipe.isSuccess);

  const stageStyle = {
    "--vfx-color": recipe.color,
    "--vfx-secondary": recipe.secondaryColor,
    "--vfx-tertiary": recipe.tertiaryColor,
    "--vfx-wash": recipe.wash,
    "--vfx-rotation": `${recipe.rotation}deg`,
    "--vfx-duration": `${recipe.durationMs}ms`,
    "--vfx-bloom": recipe.bloomScale,
    "--vfx-impact": recipe.impactStrength,
    "--vfx-texture-bloom": `url(${textures.bloom})`,
    "--vfx-texture-burst": `url(${textures.burst})`,
    "--vfx-texture-impact": `url(${textures.impact})`,
    "--vfx-texture-seal": `url(${textures.seal})`,
  } as CSSProperties;

  return (
    <div className="magic-vfx-layer" aria-hidden="true">
      <div
        key={recipe.spellHash}
        className={[
          "magic-vfx-stage",
          `magic-vfx-element-${recipe.element}`,
          `magic-vfx-${recipe.motion}`,
          `magic-vfx-${recipe.intensity}`,
          `magic-vfx-destination-${recipe.destinationLane}`,
          `magic-vfx-ring-${recipe.ringStyle}`,
          `magic-vfx-particle-${recipe.particleKind}`,
          recipe.isSuccess ? "magic-vfx-success" : "magic-vfx-failure",
        ].join(" ")}
        style={stageStyle}
      >
        <div className="magic-vfx-ink-bloom">
          <div className="magic-vfx-texture magic-vfx-texture-bloom" />
        </div>
        <div className="magic-vfx-ink-residual" />
        <div className="magic-vfx-texture magic-vfx-texture-burst" />

        <div className="magic-vfx-core">
          {formula ? (
            <svg className="magic-vfx-mandala" viewBox="0 0 100 100">
              <defs>
                <radialGradient id={`vfx-glow-${recipe.spellHash}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={recipe.color} stopOpacity="0.45" />
                  <stop offset="55%" stopColor={recipe.secondaryColor} stopOpacity="0.12" />
                  <stop offset="100%" stopColor={recipe.tertiaryColor} stopOpacity="0" />
                </radialGradient>
                <filter id={`vfx-blur-${recipe.spellHash}`}>
                  <feGaussianBlur stdDeviation="1.2" />
                </filter>
              </defs>

              <circle cx="50" cy="50" r="44" fill={`url(#vfx-glow-${recipe.spellHash})`} opacity="0.5" />

              <circle
                className="magic-vfx-trace magic-vfx-trace-outer"
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={recipe.color}
                strokeWidth="1.4"
                pathLength="1"
              />

              {formula.sigilContainment && (
                <circle
                  className="magic-vfx-trace magic-vfx-trace-inner"
                  cx="50"
                  cy="50"
                  r={Math.max(7, (formula.sigilContainment.radius / Math.max(1, formula.castingCircle?.radius ?? 1)) * 42)}
                  fill="none"
                  stroke={recipe.secondaryColor}
                  strokeWidth="0.9"
                  pathLength="1"
                />
              )}

              {formula.keyScopeCircles.map((circle, index) => {
                const point = projectFormulaPoint(result, circle.center);
                return (
                  <circle
                    key={circle.id}
                    className="magic-vfx-trace magic-vfx-trace-scope"
                    cx={point.x}
                    cy={point.y}
                    r={Math.max(4, (circle.radius / Math.max(1, formula.castingCircle?.radius ?? 1)) * 42)}
                    fill="none"
                    stroke={recipe.secondaryColor}
                    strokeWidth="0.6"
                    pathLength="1"
                    style={{ animationDelay: `${120 + index * 80}ms` }}
                  />
                );
              })}

              {formula.channels.map((channel, index) => {
                const from = entityCenters.get(channel.fromId);
                const to = entityCenters.get(channel.toId);
                if (!from || !to) return null;
                const a = projectFormulaPoint(result, from);
                const b = projectFormulaPoint(result, to);
                const control = channel.arcCenter
                  ? projectFormulaPoint(result, channel.arcCenter)
                  : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                const isInvalid = channel.geometry === "invalid_straight";
                return (
                  <path
                    key={channel.id}
                    className={`magic-vfx-trace magic-vfx-trace-channel${isInvalid ? " magic-vfx-trace-invalid" : ""}`}
                    d={`M ${a.x.toFixed(2)} ${a.y.toFixed(2)} Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`}
                    fill="none"
                    stroke={isInvalid ? recipe.tertiaryColor : recipe.color}
                    strokeWidth={isInvalid ? 0.5 : 1.1}
                    pathLength="1"
                    style={{ animationDelay: `${200 + index * 90}ms` }}
                  />
                );
              })}

              {formula.sigils.map((sigil, index) => {
                const point = projectFormulaPoint(result, sigil.center);
                return (
                  <g key={sigil.id}>
                    <circle
                      className="magic-vfx-sigil-burst"
                      cx={point.x}
                      cy={point.y}
                      r="4.5"
                      fill="none"
                      stroke={recipe.color}
                      strokeWidth="0.8"
                      style={{ animationDelay: `${340 + index * 70}ms` }}
                    />
                    <circle
                      className="magic-vfx-sigil-core"
                      cx={point.x}
                      cy={point.y}
                      r="2.2"
                      fill={recipe.color}
                      filter={`url(#vfx-blur-${recipe.spellHash})`}
                      style={{ animationDelay: `${380 + index * 70}ms` }}
                    />
                  </g>
                );
              })}

              {formula.keys.map((key, index) => {
                const point = projectFormulaPoint(result, key.center);
                return (
                  <rect
                    key={key.id}
                    className="magic-vfx-key-flash"
                    x={point.x - 2.8}
                    y={point.y - 2.8}
                    width="5.6"
                    height="5.6"
                    fill="none"
                    stroke={recipe.secondaryColor}
                    strokeWidth="0.9"
                    style={{ animationDelay: `${420 + index * 60}ms` }}
                  />
                );
              })}
            </svg>
          ) : (
            recipe.element !== "neutral" && <div className="magic-vfx-glyph" />
          )}

          {Array.from({ length: recipe.ringCount }, (_, index) => (
            <span
              key={`${recipe.spellHash}-ring-${index}`}
              className="magic-vfx-ring"
              style={{ animationDelay: `${280 + index * 110}ms` }}
            />
          ))}

          {recipe.ringStyle === "hexagon" && (
            <svg className="magic-vfx-hex-ring" viewBox="0 0 100 100">
              <polygon
                className="magic-vfx-trace"
                points="50,14 82,32 82,68 50,86 18,68 18,32"
                fill="none"
                stroke={recipe.color}
                strokeWidth="0.8"
                pathLength="1"
                style={{ animationDelay: "360ms" }}
              />
            </svg>
          )}

          {particles.map((particle) => (
            <span
              key={particle.id}
              className="magic-vfx-particle"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                animationDelay: particle.delay,
                "--vfx-drift-x": `${particle.driftX}px`,
                "--vfx-drift-y": `${particle.driftY}px`,
              } as CSSProperties}
            />
          ))}

          {sparks.map((spark) => (
            <span
              key={spark.id}
              className="magic-vfx-spark"
              style={{
                left: `${spark.x}%`,
                top: `${spark.y}%`,
                animationDelay: spark.delay,
                "--vfx-drift-x": `${spark.driftX}px`,
                "--vfx-drift-y": `${spark.driftY}px`,
              } as CSSProperties}
            />
          ))}
        </div>

        <div className="magic-vfx-impact">
          <div className="magic-vfx-texture magic-vfx-texture-impact" />
        </div>
        <div className="magic-vfx-seal-flash">
          <div className="magic-vfx-texture magic-vfx-texture-seal" />
        </div>
      </div>
    </div>
  );
}