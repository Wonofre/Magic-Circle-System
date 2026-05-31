import { X, Circle, Hexagon, Key, Sparkles } from 'lucide-react';
import { SIGILS, SIGNS } from '@/lib/magicSystem';
import type { SigilType, SignType } from '@/types/magic';
import { PerfectGlyphPreview } from '@/components/PerfectGlyphPreview';
import { useState } from 'react';

interface GuidePanelProps {
  onClose: () => void;
}

const sigilColors: Record<SigilType, string> = {
  fire:    '#e85d3e',
  water:   '#3b8dd4',
  earth:   '#8b6f47',
  wind:    '#7ec8a0',
  light:   '#f0d060',
  ice:     '#88d4ee',
  shadow:  '#9b6bcc',
  thunder: '#e0d020',
  nature:  '#44cc66',
  void:    '#8866aa',
};

type Tab = 'howto' | 'sigils' | 'signs' | 'tips';

export function GuidePanel({ onClose }: GuidePanelProps) {
  const [tab, setTab] = useState<Tab>('sigils');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'howto',  label: 'Como Jogar' },
    { id: 'sigils', label: 'Sigilos' },
    { id: 'signs',  label: 'Chaves' },
    { id: 'tips',   label: 'Dicas' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a0f14] border-2 border-amber-700/60 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-amber-900/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-amber-200">Guia de Magia</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-amber-900/30 rounded-lg transition-colors">
            <X className="w-5 h-5 text-amber-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-amber-900/30 flex-shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === t.id
                  ? 'text-amber-300 border-b-2 border-amber-500 bg-amber-900/20'
                  : 'text-amber-600 hover:text-amber-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">

          {/* HOW TO PLAY */}
          {tab === 'howto' && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Circle className="w-4 h-4" /> Como Lançar Magia
              </h3>
              <div className="space-y-3 text-xs text-amber-300/70">
                {[
                  { n: 1, title: 'Desenhe um Sigilo', desc: 'Desenhe o símbolo elemental NO CENTRO do canvas. Cada elemento tem uma forma característica.' },
                  { n: 2, title: 'Adicione Chaves', desc: 'Desenhe modificadores AO REDOR do sigilo para alterar como a magia se manifesta.' },
                  { n: 3, title: 'Feche o Círculo', desc: 'Desenhe um círculo GRANDE que envolva tudo, e feche-o conectando o fim ao início.' },
                  { n: 4, title: 'Ative!', desc: 'Ao fechar o círculo, a magia é avaliada. Quanto mais preciso o desenho, mais poderoso o feitiço!' },
                ].map(step => (
                  <div key={step.n} className="flex items-start gap-3 p-3 bg-amber-950/30 rounded-xl border border-amber-900/20">
                    <span className="bg-amber-800/60 text-amber-300 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                      {step.n}
                    </span>
                    <div>
                      <p className="font-semibold text-amber-300 mb-0.5">{step.title}</p>
                      <p>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-purple-950/30 border border-purple-800/30 rounded-xl">
                <p className="text-xs font-bold text-purple-300 mb-2">⚗️ Combinações de Elementos</p>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-purple-300/70">
                  {[
                    ['Fogo + Vento', 'Explosão'],
                    ['Gelo + Trovão', 'Tempestade Ártica'],
                    ['Luz + Trovão', 'Poder Divino'],
                    ['Vazio + Sombra', 'Caos Absoluto'],
                    ['Fogo + Terra', 'Magma'],
                    ['Natureza + Água', 'Floresta Luxuriante'],
                  ].map(([combo, result]) => (
                    <div key={combo} className="flex items-center gap-1">
                      <span className="text-purple-500">◆</span>
                      <span className="font-medium text-purple-200">{combo}</span>
                      <span className="text-purple-500">→</span>
                      <span>{result}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* SIGILS */}
          {tab === 'sigils' && (
            <section>
              <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                <Hexagon className="w-4 h-4" /> Sigilos — Como Desenhar
              </h3>
              <div className="space-y-2">
                {(Object.values(SIGILS)).map(sigil => (
                  <div
                    key={sigil.type}
                    className="flex items-start gap-3 p-3 rounded-xl border transition-colors"
                    style={{
                      background: `${sigilColors[sigil.type]}11`,
                      borderColor: `${sigilColors[sigil.type]}33`,
                    }}
                  >
                    <div
                      className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 border"
                      style={{
                        background: `${sigilColors[sigil.type]}22`,
                        borderColor: `${sigilColors[sigil.type]}44`,
                      }}
                    >
                      <PerfectGlyphPreview mode="sigil" type={sigil.type} size={58} strokeWidth={4} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold" style={{ color: sigilColors[sigil.type] }}>
                          {sigil.namePt}
                        </span>
                        <span className="text-[9px] text-amber-700">({sigil.name})</span>
                      </div>
                      <p className="text-[10px] text-amber-400/80 mb-1">{sigil.description}</p>
                      <div
                        className="text-[10px] px-2 py-1 rounded-lg inline-block"
                        style={{ background: `${sigilColors[sigil.type]}22`, color: `${sigilColors[sigil.type]}dd` }}
                      >
                        ✏️ {sigil.howToDraw}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SIGNS */}
          {tab === 'signs' && (
            <section>
              <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                <Key className="w-4 h-4" /> Chaves — Como Desenhar
              </h3>
              <div className="space-y-1.5">
                {Object.values(SIGNS).map(sign => (
                  <div key={sign.type} className="p-2.5 bg-purple-950/20 rounded-xl border border-purple-900/25">
                    <div className="flex items-start gap-2">
                      <div className="w-14 h-14 rounded-lg bg-purple-950/30 border border-purple-800/30 flex items-center justify-center flex-shrink-0">
                        <PerfectGlyphPreview mode="sign" type={sign.type as SignType} size={50} strokeWidth={4} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-purple-300">{sign.namePt}</span>
                          <span className="text-[9px] text-purple-600">({sign.name})</span>
                        </div>
                        <p className="text-[10px] text-purple-400/70 mb-1">{sign.effect}</p>
                        <p className="text-[10px] text-pink-300/70">✏️ {sign.howToDraw}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TIPS */}
          {tab === 'tips' && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-amber-400">Dicas Avançadas</h3>
              <ul className="space-y-2.5 text-xs text-amber-300/70">
                {[
                  { icon: '◆', text: 'A precisão do círculo externo é o fator mais importante na potência da magia.' },
                  { icon: '◆', text: 'Combinar dois sigilos cria efeitos únicos muito mais poderosos.' },
                  { icon: '◆', text: 'Cada chave muda radicalmente como a magia se comporta. Experimente!' },
                  { icon: '◆', text: 'Acertos consecutivos criam o Combo Multiplier que aumenta o score.' },
                  { icon: '◆', text: 'Use Chave de Escudo (D) ou Cura (+) para sobreviver nos rounds difíceis.' },
                  { icon: '◆', text: 'Cada inimigo tem fraquezas específicas. Verifique antes de atacar.' },
                  { icon: '◆', text: 'O Vazio (Vacuus) é o elemento mais poderoso, mas requer precisão.' },
                  { icon: '◆', text: 'A Chave de Explosão tem o maior dano em área mas a menor precisão.' },
                  { icon: '◆', text: 'Sigilos devem ser desenhados no CENTRO; chaves ficam ao REDOR.' },
                  { icon: '◆', text: 'Você tem 45 segundos por turno — use bem o tempo!' },
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">{tip.icon}</span>
                    {tip.text}
                  </li>
                ))}
              </ul>

              {/* Quick reference table */}
              <div>
                <p className="text-xs font-bold text-amber-400 mb-2">Tabela de Fraquezas Rápida</p>
                <div className="space-y-1">
                  {[
                    { elem: 'Fogo', weak: 'Água, Gelo, Vazio' },
                    { elem: 'Água', weak: 'Terra, Trovão, Natureza' },
                    { elem: 'Gelo', weak: 'Fogo, Trovão' },
                    { elem: 'Trovão', weak: 'Terra' },
                    { elem: 'Sombra', weak: 'Luz' },
                    { elem: 'Natureza', weak: 'Fogo, Gelo, Sombra' },
                    { elem: 'Vazio', weak: 'Luz, Sombra' },
                  ].map(row => (
                    <div key={row.elem} className="flex items-center gap-2 text-[10px]">
                      <span className="w-16 text-amber-300 font-medium">{row.elem}</span>
                      <span className="text-amber-700">→ fraco vs</span>
                      <span className="text-red-400/80">{row.weak}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
