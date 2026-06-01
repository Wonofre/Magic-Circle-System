import { Suspense, lazy, useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { Point, DrawingStroke, GlyphComponent, PrecisionBreakdown } from '@/types/magic';
import { analyzeGlyphFromStrokes, analyzeStroke, closeStrokeIfNear, getClosureDistance } from '@/lib/magicSystem';

interface GameCanvasProps {
  onGlyphComplete: (components: GlyphComponent[], precision: PrecisionBreakdown) => void;
  isDrawingEnabled: boolean;
  glowColor: string;
  elementName: string;
  inkAvailable: number;
  onInkDrag: (distance: number) => number;
}

const CANVAS_SIZE = 520;
const CENTER = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };
const IDEAL_RADIUS = 160;
const MIN_DRAW_INK = 0.03;
const GlyphDebugPanel = lazy(() =>
  import('@/components/GlyphDebugPanel').then((module) => ({
    default: module.GlyphDebugPanel,
  })),
);

const isGlyphDebugEnabled = () => {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  return params.get('glyphDebug') === '1' || window.localStorage.getItem('glyphDebug') === '1';
};

export function GameCanvas({
  onGlyphComplete,
  isDrawingEnabled,
  glowColor,
  elementName,
  inkAvailable,
  onInkDrag,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackColor, setFeedbackColor] = useState('#c9a23b');
  const [ringClosed, setRingClosed] = useState(false);
  const [components, setComponents] = useState<GlyphComponent[]>([]);
  const [closureProgress, setClosureProgress] = useState(0);
  const animationRef = useRef<number>(0);
  const strokesRef = useRef<DrawingStroke[]>([]);
  const finalizingRef = useRef(false);
  const [glyphDebugEnabled] = useState(isGlyphDebugEnabled);
  const debugStrokes = useMemo(() => {
    if (currentStroke.length === 0) return strokes;

    return [
      ...strokes,
      {
        id: 'debug-current-stroke',
        points: currentStroke,
        timestamp: Date.now(),
      },
    ];
  }, [strokes, currentStroke]);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scale = CANVAS_SIZE / rect.width;
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? e.changedTouches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? e.changedTouches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scale,
      y: (clientY - rect.top) * scale,
    };
  }, []);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const finalizeGlyph = useCallback((sourceStrokes: DrawingStroke[] = strokesRef.current) => {
    if (finalizingRef.current || sourceStrokes.length === 0) return false;
    finalizingRef.current = true;

    const { components: finalComponents, precision } = analyzeGlyphFromStrokes(sourceStrokes, CENTER);
    const hasRing = finalComponents.some(component => component.type === 'ring');

    setComponents(finalComponents);
    setRingClosed(hasRing);
    setFeedback(hasRing ? 'Círculo fechado. Lendo o glifo...' : 'Tempo esgotado. Lendo o desenho...');
    setFeedbackColor(hasRing ? '#88ff88' : '#ffcc66');

    setTimeout(() => {
      onGlyphComplete(finalComponents, precision);
    }, 350);

    return true;
  }, [onGlyphComplete]);

  const startStroke = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingEnabled || ringClosed || finalizingRef.current) return;
    e.preventDefault();
    if (inkAvailable <= MIN_DRAW_INK) {
      setFeedback('A tinta acabou. Espere o proximo turno.');
      setFeedbackColor('#67e8f9');
      return;
    }
    const pos = getPos(e);
    setIsDrawing(true);
    setCurrentStroke([pos]);
    setFeedback('');
  }, [isDrawingEnabled, ringClosed, finalizingRef, inkAvailable, getPos]);

  const continueStroke = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawingEnabled || finalizingRef.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const last = currentStroke[currentStroke.length - 1];
    if (!last) return;

    const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
    if (dist < 3) return;

    const spentInk = onInkDrag(dist);
    if (spentInk <= 0) {
      if (currentStroke.length >= 5) {
        const dryStroke = { id: crypto.randomUUID(), points: currentStroke, timestamp: Date.now() };
        const nextStrokes = [...strokes, dryStroke];
        strokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
      }
      setFeedback('A tinta secou no meio do traco.');
      setFeedbackColor('#67e8f9');
      setIsDrawing(false);
      setCurrentStroke([]);
      return;
    }

    const newStroke = [...currentStroke, pos];
    setCurrentStroke(newStroke);

    if (newStroke.length > 30) {
      const closeDist = getClosureDistance(newStroke);
      const progress = Math.max(0, 100 - closeDist * 2);
      setClosureProgress(Math.min(100, progress));

      if (closeDist < 18) {
        const analysis = analyzeStroke(closeStrokeIfNear(newStroke, 35), CENTER);
        if (analysis.isRing) {
          setFeedback('Solte para fechar e revelar.');
          setFeedbackColor('#88ff88');
        }
      } else if (closeDist < 42) {
        setFeedback(`Quase la... (${Math.round(closeDist)}px)`);
        setFeedbackColor('#ffcc66');
      }
    }
  }, [isDrawing, isDrawingEnabled, currentStroke, strokes, getPos, onInkDrag]);

  const endStroke = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    setClosureProgress(0);

    if (currentStroke.length < 5) {
      setCurrentStroke([]);
      return;
    }

    const closedStroke = closeStrokeIfNear(currentStroke, 28);
    const nextStrokes = [...strokes, { id: crypto.randomUUID(), points: closedStroke, timestamp: Date.now() }];
    strokesRef.current = nextStrokes;
    setStrokes(nextStrokes);

    const analysis = analyzeStroke(closedStroke, CENTER);
    if (analysis.isRing) {
      setRingClosed(true);
      setTimeout(() => finalizeGlyph(nextStrokes), 250);
    }

    setCurrentStroke([]);
  }, [isDrawing, currentStroke, strokes, finalizeGlyph]);

  const reset = useCallback(() => {
    setStrokes([]);
    strokesRef.current = [];
    setCurrentStroke([]);
    setComponents([]);
    setRingClosed(false);
    setFeedback('');
    setClosureProgress(0);
    finalizingRef.current = false;
  }, []);

  useEffect(() => {
    const windowWithCanvas = window as unknown as Record<string, unknown>;
    windowWithCanvas.__resetCanvas = reset;
    windowWithCanvas.__finalizeCanvas = () => finalizeGlyph(strokesRef.current);
  }, [reset, finalizeGlyph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxOrNull = canvas.getContext('2d');
    if (!ctxOrNull) return;
    const ctx = ctxOrNull;

    let running = true;
    let time = 0;

    function render() {
      if (!running || !canvasRef.current) return;
      time += 0.016;
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      ctx.fillStyle = '#0f080c';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      const grad = ctx.createRadialGradient(CENTER.x, CENTER.y, 20, CENTER.x, CENTER.y, 250);
      grad.addColorStop(0, 'rgba(30, 15, 20, 1)');
      grad.addColorStop(1, 'rgba(10, 5, 8, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      ctx.beginPath();
      ctx.arc(CENTER.x, CENTER.y, IDEAL_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(180, 140, 80, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 14]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(CENTER.x, CENTER.y, 50, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(180, 140, 80, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const glowPulse = Math.sin(time * 2) * 0.05 + 0.15;
      const centerGlow = ctx.createRadialGradient(CENTER.x, CENTER.y, 0, CENTER.x, CENTER.y, 60);
      centerGlow.addColorStop(0, glowColor.replace(')', `, ${glowPulse})`).replace('rgb', 'rgba'));
      centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = centerGlow;
      ctx.beginPath();
      ctx.arc(CENTER.x, CENTER.y, 60, 0, Math.PI * 2);
      ctx.fill();

      strokes.forEach(stroke => {
        if (stroke.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.strokeStyle = '#f3d779';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#f3d779';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      if (currentStroke.length > 1) {
        const closeDist = currentStroke.length > 30 ? getClosureDistance(currentStroke) : Infinity;
        const strokeColor = closeDist < 60 ? '#88ff88' : '#ffffff';

        ctx.beginPath();
        ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
        for (let i = 1; i < currentStroke.length; i++) {
          ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(currentStroke[0].x, currentStroke[0].y, 5, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();

        if (closeDist < 60) {
          const first = currentStroke[0];
          const last = currentStroke[currentStroke.length - 1];
          ctx.beginPath();
          ctx.arc(first.x, first.y, closeDist, 0, Math.PI * 2);
          const proximityAlpha = Math.max(0, 0.3 - closeDist * 0.005);
          ctx.strokeStyle = `rgba(136, 255, 136, ${proximityAlpha})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(first.x, first.y);
          ctx.strokeStyle = `rgba(136, 255, 136, ${proximityAlpha * 0.5})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      if (closureProgress > 0 && !ringClosed) {
        ctx.beginPath();
        ctx.arc(CENTER.x, CENTER.y, 200, -Math.PI / 2, -Math.PI / 2 + (closureProgress / 100) * Math.PI * 2);
        ctx.strokeStyle = `rgba(136, 255, 136, ${closureProgress / 200})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (ringClosed) {
        ctx.beginPath();
        ctx.arc(CENTER.x, CENTER.y, 210, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(243, 215, 121, ${0.3 + Math.sin(time * 4) * 0.15})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#f3d779';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time * 0.2;
        const x = CENTER.x + Math.cos(angle) * 230;
        const y = CENTER.y + Math.sin(angle) * 230;
        ctx.fillStyle = `rgba(180, 140, 80, ${0.15 + Math.sin(time + i) * 0.05})`;
        ctx.font = '10px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('◆', x, y);
      }

      animationRef.current = requestAnimationFrame(render);
    }

    render();

    return () => {
      running = false;
      cancelAnimationFrame(animationRef.current);
    };
  }, [strokes, currentStroke, ringClosed, closureProgress, glowColor, components]);

  return (
    <div className="relative w-full max-w-[520px] mx-auto">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className={`w-full rounded-2xl border-2 cursor-crosshair transition-all duration-300 ${
          ringClosed
            ? 'border-amber-400 shadow-[0_0_40px_rgba(243,215,121,0.4)]'
            : isDrawingEnabled
            ? 'border-amber-900/60 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:border-amber-700/80'
            : 'border-gray-800 opacity-70'
        }`}
        style={{ aspectRatio: '1' }}
        onMouseDown={startStroke}
        onMouseMove={continueStroke}
        onMouseUp={endStroke}
        onMouseLeave={endStroke}
        onTouchStart={startStroke}
        onTouchMove={continueStroke}
        onTouchEnd={endStroke}
      />

      {feedback && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all"
          style={{
            backgroundColor: 'rgba(0,0,0,0.75)',
            color: feedbackColor,
            textShadow: `0 0 8px ${feedbackColor}66`,
          }}
        >
          {feedback}
        </div>
      )}

      {elementName && isDrawingEnabled && (
        <div className="absolute top-3 left-3 px-2 py-1 rounded-lg text-xs bg-black/60 text-amber-300 border border-amber-800/50">
          {elementName}
        </div>
      )}

      {glyphDebugEnabled && (
        <Suspense fallback={null}>
          <GlyphDebugPanel strokes={debugStrokes} />
        </Suspense>
      )}
    </div>
  );
}
