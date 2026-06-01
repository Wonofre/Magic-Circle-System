import type { EnemySpellPlan } from "@/lib/spell/enemySpellAI";
import { Activity, Droplets, Sparkles } from "lucide-react";

interface EnemyCastPreviewProps {
  readonly plan: EnemySpellPlan | null;
}

const getPolylinePoints = (points: EnemySpellPlan["strokes"][number]["points"]): string =>
  points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");

export function EnemyCastPreview({ plan }: EnemyCastPreviewProps) {
  if (!plan) return null;

  return (
    <section className="mt-3 border border-violet-800/40 bg-violet-950/20 rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-300 shrink-0" />
            <h3 className="text-sm font-semibold text-violet-100 truncate">{plan.spellName}</h3>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-violet-200/70">{plan.effectText}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[10px] text-violet-200/70">
          <span className="inline-flex items-center gap-1">
            <Droplets className="w-3 h-3" />
            {plan.expectedInkCost}
          </span>
          <span className="inline-flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {plan.expectedPower}
          </span>
        </div>
      </div>

      <div className="mt-3 h-32 overflow-hidden rounded-lg border border-violet-800/30 bg-black/35">
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Desenho da magia inimiga">
          <defs>
            <radialGradient id="enemy-cast-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgb(196 181 253)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="rgb(76 29 149)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100" height="100" fill="url(#enemy-cast-glow)" />
          {plan.strokes.map((stroke) => (
            <polyline
              key={stroke.id}
              points={getPolylinePoints(stroke.points)}
              fill="none"
              stroke="rgb(196 181 253)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.45"
              opacity="0.9"
            />
          ))}
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-violet-300/65">
        <span>Perfil: {plan.profile}</span>
        <span>{plan.graph ? plan.graph.spellHash : "grafo instavel"}</span>
      </div>
    </section>
  );
}
