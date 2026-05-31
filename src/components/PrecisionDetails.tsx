import { useState } from 'react';
import type { PrecisionBreakdown } from '@/types/magic';
import { Target, Circle, Hexagon, Key, Scale, Ratio, ChevronDown, ChevronUp, Award } from 'lucide-react';

interface PrecisionDetailsProps {
  precision: PrecisionBreakdown | null;
}

export function PrecisionDetails({ precision }: PrecisionDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  if (!precision) return null;

  const items = [
    { label: 'Perfeição do Círculo', value: precision.circlePerfection, icon: <Circle className="w-4 h-4" />, color: 'text-amber-400' },
    { label: 'Fechamento do Anel', value: precision.ringClosure, icon: <Target className="w-4 h-4" />, color: 'text-emerald-400' },
    { label: 'Precisão dos Sigilos', value: precision.sigilPrecision, icon: <Hexagon className="w-4 h-4" />, color: 'text-sky-400' },
    { label: 'Precisão das Chaves', value: precision.signPrecision, icon: <Key className="w-4 h-4" />, color: 'text-pink-400' },
    { label: 'Simetria', value: precision.symmetry, icon: <Scale className="w-4 h-4" />, color: 'text-violet-400' },
    { label: 'Proporções', value: precision.proportions, icon: <Ratio className="w-4 h-4" />, color: 'text-orange-400' },
  ];

  return (
    <div className="w-full max-w-[520px] mx-auto">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 bg-amber-950/30 border border-amber-900/30 rounded-xl hover:bg-amber-900/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-amber-300/80">Análise do Glifo</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${
            precision.overall >= 80 ? 'text-emerald-400'
            : precision.overall >= 50 ? 'text-amber-400'
            : 'text-red-400'
          }`}>
            {precision.overall}%
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-2 p-3 bg-black/40 border border-amber-900/20 rounded-xl space-y-2">
          {items.map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <div className={`${item.color} opacity-70`}>{item.icon}</div>
              <span className="text-xs text-amber-400/70 flex-1">{item.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.value >= 80 ? 'bg-emerald-500'
                      : item.value >= 50 ? 'bg-amber-500'
                      : item.value > 0 ? 'bg-red-500'
                      : 'bg-gray-700'
                    }`}
                    style={{ width: `${Math.max(5, item.value)}%` }}
                  />
                </div>
                <span className={`text-xs w-8 text-right ${item.color}`}>{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
