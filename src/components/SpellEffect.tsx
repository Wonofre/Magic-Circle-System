import { useEffect, useState } from 'react';
import type { CastResult } from '@/lib/spellEngine';
import { Zap, Shield, Heart, Crosshair, Sparkles, TrendingUp, AlertTriangle, X } from 'lucide-react';
import type { SigilType } from '@/types/magic';

interface SpellEffectProps {
  result: CastResult | null;
  onComplete: () => void;
}

const elementColors: Record<SigilType, { bg: string; border: string; text: string; glow: string }> = {
  fire:    { bg: 'rgba(120,30,10,0.92)', border: 'rgba(232,93,62,0.7)',  text: '#ff9966', glow: '#e85d3e' },
  water:   { bg: 'rgba(10,40,90,0.92)',  border: 'rgba(59,141,212,0.7)', text: '#66bbff', glow: '#3b8dd4' },
  earth:   { bg: 'rgba(50,30,10,0.92)',  border: 'rgba(139,111,71,0.7)', text: '#ddaa66', glow: '#8b6f47' },
  wind:    { bg: 'rgba(10,50,30,0.92)',  border: 'rgba(126,200,160,0.7)',text: '#88eebb', glow: '#7ec8a0' },
  light:   { bg: 'rgba(70,55,5,0.92)',   border: 'rgba(240,208,96,0.7)', text: '#ffe066', glow: '#f0d060' },
  ice:     { bg: 'rgba(5,40,60,0.92)',   border: 'rgba(136,212,238,0.7)',text: '#aaeeff', glow: '#88d4ee' },
  shadow:  { bg: 'rgba(30,10,50,0.92)',  border: 'rgba(155,107,204,0.7)',text: '#cc99ff', glow: '#9b6bcc' },
  thunder: { bg: 'rgba(60,55,5,0.92)',   border: 'rgba(224,208,32,0.7)', text: '#ffff55', glow: '#e0d020' },
  nature:  { bg: 'rgba(10,50,20,0.92)',  border: 'rgba(68,204,102,0.7)', text: '#88ee99', glow: '#44cc66' },
  void:    { bg: 'rgba(20,10,35,0.92)',  border: 'rgba(136,102,170,0.7)',text: '#bb99dd', glow: '#8866aa' },
};

const failColors = { bg: 'rgba(20,20,20,0.95)', border: 'rgba(120,60,60,0.7)', text: '#ff8888', glow: '#cc4444' };

export function SpellEffectDisplay({ result, onComplete }: SpellEffectProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!result) {
      return;
    }

    // Small delay before appearing so canvas reset is done first
    const tReset = setTimeout(() => setDismissed(false), 0);
    const t0 = setTimeout(() => setVisible(true), 100);

    // Auto dismiss after 3.5s
    const t1 = setTimeout(() => {
      setVisible(false);
    }, 3500);

    const t2 = setTimeout(() => {
      onComplete();
    }, 4000);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(tReset);
    };
  }, [result, onComplete]);

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    setTimeout(onComplete, 300);
  };

  if (!result || dismissed) return null;

  const primarySigil = result.primarySigil;
  const colors = result.isSuccess && primarySigil && elementColors[primarySigil]
    ? elementColors[primarySigil]
    : failColors;

  const isSuccess = result.isSuccess;
  const hasDamage = result.damage > 0;
  const hasHeal = result.healing > 0;
  const hasShield = result.shield > 0;
  const isSuper = result.elementalMultiplier > 1.5;
  const isResisted = result.elementalMultiplier < 0.8 && result.elementalMultiplier > 0;

  return (
    /* Positioned as a compact toast in the TOP-RIGHT - never blocks the canvas */
    <div
      className="fixed top-4 right-4 z-50 pointer-events-none"
      style={{
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(110%) scale(0.85)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
        maxWidth: '280px',
        width: 'calc(100vw - 2rem)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: colors.bg,
          border: `1.5px solid ${colors.border}`,
          boxShadow: `0 0 24px ${colors.glow}44, 0 8px 32px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Glow stripe at top */}
        <div
          className="h-0.5 w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${colors.glow}, transparent)` }}
        />

        {/* Main content */}
        <div className="p-3 pb-2">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {isSuccess ? (
                <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: colors.text }} />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
              )}
              <span
                className="font-bold text-sm leading-tight truncate"
                style={{ color: colors.text }}
              >
                {result.spellName}
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-0.5 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: colors.text, pointerEvents: 'auto' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Stats row */}
          {isSuccess && (hasDamage || hasHeal || hasShield) && (
            <div className="flex items-center gap-2 mb-2">
              {hasDamage && (
                <div className="flex items-center gap-1 bg-red-950/50 px-2 py-0.5 rounded-lg border border-red-800/40">
                  <Zap className="w-3 h-3 text-red-400" />
                  <span className="text-lg font-bold text-red-300 leading-none">{result.damage}</span>
                  <span className="text-[9px] text-red-500/70">dano</span>
                </div>
              )}
              {hasHeal && (
                <div className="flex items-center gap-1 bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-800/40">
                  <Heart className="w-3 h-3 text-emerald-400" />
                  <span className="text-lg font-bold text-emerald-300 leading-none">{result.healing}</span>
                  <span className="text-[9px] text-emerald-500/70">cura</span>
                </div>
              )}
              {hasShield && (
                <div className="flex items-center gap-1 bg-blue-950/50 px-2 py-0.5 rounded-lg border border-blue-800/40">
                  <Shield className="w-3 h-3 text-blue-400" />
                  <span className="text-lg font-bold text-blue-300 leading-none">{result.shield}</span>
                  <span className="text-[9px] text-blue-500/70">escudo</span>
                </div>
              )}
            </div>
          )}

          {/* Tags row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                background: result.precision >= 75 ? 'rgba(20,80,20,0.5)' : result.precision >= 50 ? 'rgba(80,60,0,0.5)' : 'rgba(80,20,20,0.5)',
                color: result.precision >= 75 ? '#88ee88' : result.precision >= 50 ? '#ddaa44' : '#ff7777',
                border: `1px solid ${result.precision >= 75 ? 'rgba(68,204,68,0.3)' : result.precision >= 50 ? 'rgba(200,160,0,0.3)' : 'rgba(200,60,60,0.3)'}`,
              }}
            >
              <Crosshair className="w-2.5 h-2.5" />
              {result.precision}%
            </span>

            {isSuper && (
              <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-950/60 text-orange-300 border border-orange-700/40">
                <TrendingUp className="w-2.5 h-2.5" />
                Super Efetivo!
              </span>
            )}
            {isResisted && (
              <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-700/40">
                Resistido
              </span>
            )}
          </div>

          {/* Feedback line */}
          {result.feedback && (
            <p className="text-[10px] mt-1.5 leading-tight" style={{ color: `${colors.text}99` }}>
              {result.feedback}
            </p>
          )}
        </div>

        {/* Auto-dismiss progress bar */}
        <div className="h-0.5 bg-white/5">
          <div
            className="h-full"
            style={{
              background: colors.glow,
              animation: visible ? 'shrink-bar 3.4s linear forwards' : 'none',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes shrink-bar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
