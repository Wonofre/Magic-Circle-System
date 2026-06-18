import type { CSSProperties } from "react";
import type { EnemySpellPlan } from "@/lib/spell/enemySpellAI";
import { Activity, Droplets, Sparkles } from "lucide-react";

interface EnemyCastPreviewProps {
  readonly plan: EnemySpellPlan | null;
}

const getPolylinePoints = (points: EnemySpellPlan["strokes"][number]["points"]): string =>
  points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");

const estimatePathLength = (points: EnemySpellPlan["strokes"][number]["points"]): number => {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.hypot(dx, dy);
  }
  return Math.max(1, length);
};

export function EnemyCastPreview({ plan }: EnemyCastPreviewProps) {
  if (!plan) return null;

  return (
    <section
      className="enemy-cast-preview mt-3 rounded-md border border-[#9b6bcc]/30 bg-[#2a1018]/60 p-4"
      role="status"
      aria-live="polite"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c49bff]/70">
        Conjuração adversária
      </p>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-[#c49bff] animate-pulse-glow" />
            <h3 className="font-display text-base font-semibold tracking-wide text-[#e8d4a8]">{plan.spellName}</h3>
          </div>
          <p className="mt-1 text-xs italic leading-relaxed text-[#c49bff]/75">{plan.effectText}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] text-[#c49bff]/65">
          <span className="inline-flex items-center gap-1">
            <Droplets className="h-3 w-3" />
            {plan.expectedInkCost}
          </span>
          <span className="inline-flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {plan.expectedPower}
          </span>
        </div>
      </div>

      <div className="enemy-cast-canvas mt-3 h-32 overflow-hidden rounded-md border border-[#9b6bcc]/25 bg-[#0d0608]/70">
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Desenho da magia inimiga">
          <defs>
            <pattern id="enemy-cast-vfx-texture" patternUnits="objectBoundingBox" width="1" height="1">
              <image
                href="/assets/vfx/vfx-umbra-burst.jpg"
                width="100"
                height="100"
                preserveAspectRatio="xMidYMid slice"
                opacity="0.35"
              />
            </pattern>
            <radialGradient id="enemy-cast-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#c49bff" stopOpacity="0.28" />
              <stop offset="60%" stopColor="#432060" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#14080c" stopOpacity="0" />
            </radialGradient>
            <filter id="enemy-cast-blur">
              <feGaussianBlur stdDeviation="0.8" />
            </filter>
          </defs>
          <rect width="100" height="100" fill="url(#enemy-cast-vfx-texture)" opacity="0.55" />
          <rect width="100" height="100" fill="url(#enemy-cast-glow)" />
          <circle
            className="enemy-cast-ring"
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke="rgba(196,155,255,0.25)"
            strokeWidth="0.6"
            pathLength="1"
          />
          {plan.strokes.map((stroke, index) => {
            const pathLen = estimatePathLength(stroke.points);
            return (
              <g key={stroke.id}>
                <polyline
                  className="enemy-cast-stroke-glow"
                  points={getPolylinePoints(stroke.points)}
                  fill="none"
                  stroke="rgba(155,107,204,0.35)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  filter="url(#enemy-cast-blur)"
                  style={{ animationDelay: `${index * 180}ms` }}
                />
                <polyline
                  className="enemy-cast-stroke"
                  points={getPolylinePoints(stroke.points)}
                  fill="none"
                  stroke="#c49bff"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  pathLength={pathLen}
                  style={{ animationDelay: `${index * 180}ms`, "--stroke-len": pathLen } as CSSProperties}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[#c49bff]/55">
        <span>Perfil: {plan.profile}</span>
        <span className="animate-pulse">Canalizando...</span>
      </div>
    </section>
  );
}