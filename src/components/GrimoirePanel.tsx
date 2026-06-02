import { useState } from 'react';
import type { SigilType, Spell } from '@/types/magic';
import { BookOpen, X, Star, Flame, Droplets, Mountain, Wind, Sun, Snowflake, Moon, CloudLightning, Leaf, Circle } from 'lucide-react';
import { PerfectGlyphPreview } from '@/components/PerfectGlyphPreview';

interface GrimoirePanelProps {
  spells: Spell[];
  onClose: () => void;
}

const elementIcons: Record<string, React.ReactNode> = {
  fire: <Flame className="w-4 h-4 text-orange-400" />,
  water: <Droplets className="w-4 h-4 text-blue-400" />,
  earth: <Mountain className="w-4 h-4 text-amber-600" />,
  wind: <Wind className="w-4 h-4 text-emerald-400" />,
  light: <Sun className="w-4 h-4 text-yellow-300" />,
  ice: <Snowflake className="w-4 h-4 text-cyan-300" />,
  shadow: <Moon className="w-4 h-4 text-purple-400" />,
  thunder: <CloudLightning className="w-4 h-4 text-yellow-400" />,
  nature: <Leaf className="w-4 h-4 text-green-400" />,
  void: <Circle className="w-4 h-4 text-violet-400" />,
};

const elementLabels: Record<SigilType, string> = {
  fire: 'Ignis',
  water: 'Aqua',
  earth: 'Terra',
  wind: 'Ventus',
  light: 'Lux',
  ice: 'Gelu',
  shadow: 'Umbra',
  thunder: 'Fulmen',
  nature: 'Vita',
  void: 'Vacuus',
};

const legacySignLabel = (sign: string): string =>
  sign.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

type GrimoireFilter = 'all' | 'discovered' | SigilType;

export function GrimoirePanel({ spells, onClose }: GrimoirePanelProps) {
  const [filter, setFilter] = useState<GrimoireFilter>('all');
  const filterOptions: GrimoireFilter[] = [
    'all',
    'discovered',
    ...([...new Set(spells.flatMap((spell) => spell.glyphPattern.sigils))] as SigilType[]),
  ];

  const filtered = spells.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'discovered') return s.discovered;
    return s.glyphPattern.sigils.includes(filter);
  });

  const discoveredCount = spells.filter(s => s.discovered).length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a0f14] border-2 border-amber-700/60 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-amber-900/40">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="text-xl font-bold text-amber-200">Catalogo Legado</h2>
              <p className="text-xs text-amber-600/80">{discoveredCount}/{spells.length} magias antigas descobertas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-amber-900/30 rounded-lg transition-colors">
            <X className="w-5 h-5 text-amber-400" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 p-3 overflow-x-auto border-b border-amber-900/30">
          {filterOptions.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                filter === f
                  ? 'bg-amber-700 text-amber-100'
                  : 'bg-amber-950/50 text-amber-600/70 hover:bg-amber-900/40'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'discovered' ? 'Descobertas' : elementLabels[f as SigilType] || f}
            </button>
          ))}
        </div>

        {/* Spells list */}
        <div className="overflow-y-auto max-h-[55vh] p-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-amber-700 py-8">Nenhuma magia encontrada</p>
          ) : (
            filtered.map(spell => (
              <div
                key={spell.id}
                className={`p-3 rounded-xl border transition-all ${
                  spell.discovered
                    ? 'bg-amber-950/40 border-amber-700/40 hover:border-amber-600/60'
                    : 'bg-black/30 border-gray-800/30 opacity-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-20 h-20 rounded-lg bg-black/30 border flex items-center justify-center flex-shrink-0 ${
                    spell.discovered ? 'border-amber-700/30' : 'border-gray-800/40'
                  }`}>
                    <PerfectGlyphPreview
                      mode="spell"
                      sigils={spell.glyphPattern.sigils}
                      signs={spell.glyphPattern.signs}
                      size={72}
                      strokeWidth={3.4}
                      className={spell.discovered ? '' : 'opacity-35'}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-amber-200 text-sm">{spell.namePt}</span>
                      {spell.discovered && spell.useCount > 0 && (
                        <span className="text-[10px] bg-amber-800/50 text-amber-400 px-1.5 py-0.5 rounded-full">
                          {spell.useCount}x
                        </span>
                      )}
                      {!spell.discovered && (
                        <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">???</span>
                      )}
                    </div>
                    <p className="text-xs text-amber-600/80 mb-2">{spell.description}</p>

                    <div className="flex items-center gap-2">
                      {spell.discovered ? (
                        <>
                          {spell.glyphPattern.sigils.map(s => (
                            <span key={s} className="flex items-center gap-1 text-xs bg-black/40 px-2 py-0.5 rounded-md">
                              {elementIcons[s]}
                              <span className="text-amber-400/80">{elementLabels[s]}</span>
                            </span>
                          ))}
                          {spell.glyphPattern.signs.map(s => (
                            <span key={s} className="text-xs bg-purple-950/40 text-purple-300/70 px-2 py-0.5 rounded-md border border-purple-800/30">
                              {legacySignLabel(s)}
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="text-xs text-gray-600 italic">Componentes desconhecidos...</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {Array.from({ length: spell.tier }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 text-amber-500 fill-amber-500" />
                    ))}
                  </div>
                </div>

                {spell.discovered && (
                  <div className="flex gap-3 mt-2 pt-2 border-t border-amber-900/20">
                    {spell.damage > 0 && (
                      <span className="text-xs text-red-400/80">Dano {spell.damage}</span>
                    )}
                    {spell.healing > 0 && (
                      <span className="text-xs text-emerald-400/80">Cura {spell.healing}</span>
                    )}
                    {spell.shield > 0 && (
                      <span className="text-xs text-blue-400/80">Escudo {spell.shield}</span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
