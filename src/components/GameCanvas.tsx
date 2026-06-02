import { Suspense, lazy, useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { Point, DrawingStroke, GlyphComponent, PrecisionBreakdown } from '@/types/magic';
import { analyzeGlyphFromStrokes, analyzeRingQuality, analyzeStroke, closeStrokeIfNear, getClosureDistance } from '@/lib/magicSystem';

interface GameCanvasProps {
  onGlyphComplete: (components: GlyphComponent[], precision: PrecisionBreakdown, strokes: DrawingStroke[]) => void;
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
const QUILL_CURSOR = 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2732%27 height=%2732%27 viewBox=%270 0 32 32%27%3E%3Cpath d=%27M5 29 L9 19 C12 10 19 4 28 2 C26 11 21 19 12 23 L5 29 Z%27 fill=%27%23f8e7b0%27 stroke=%27%235a3716%27 stroke-width=%271.4%27 stroke-linejoin=%27round%27/%3E%3Cpath d=%27M8 25 C13 19 18 12 25 5%27 fill=%27none%27 stroke=%27%235a3716%27 stroke-width=%271.2%27 stroke-linecap=%27round%27/%3E%3Cpath d=%27M5 29 L8 26 L10 28 Z%27 fill=%27%23221814%27/%3E%3C/svg%3E") 5 29, auto';
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
  const finalizeIdleTimeoutRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
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

  const getPointerPoint = useCallback((event: PointerEvent | React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scale = CANVAS_SIZE / rect.width;
    const pressure = event.pressure > 0 ? event.pressure : undefined;
    const extendedEvent = event as PointerEvent & {
      altitudeAngle?: number;
      azimuthAngle?: number;
    };
    return {
      x: (event.clientX - rect.left) * scale,
      y: (event.clientY - rect.top) * scale,
      t: event.timeStamp,
      pressure,
      tangentialPressure: event.tangentialPressure,
      tiltX: event.tiltX,
      tiltY: event.tiltY,
      twist: event.twist,
      altitudeAngle: extendedEvent.altitudeAngle,
      azimuthAngle: extendedEvent.azimuthAngle,
      pointerType: event.pointerType,
    };
  }, []);

  const getCoalescedPointerPoints = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point[] => {
    const nativeEvent = e.nativeEvent;
    const events = typeof nativeEvent.getCoalescedEvents === 'function'
      ? nativeEvent.getCoalescedEvents()
      : [nativeEvent];
    return events.map(getPointerPoint);
  }, [getPointerPoint]);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const finalizeGlyph = useCallback((sourceStrokes: DrawingStroke[] = strokesRef.current) => {
    if (finalizingRef.current || sourceStrokes.length === 0) return false;
    finalizingRef.current = true;
    if (finalizeIdleTimeoutRef.current !== null) {
      window.clearTimeout(finalizeIdleTimeoutRef.current);
      finalizeIdleTimeoutRef.current = null;
    }

    const { components: finalComponents, precision } = analyzeGlyphFromStrokes(sourceStrokes, CENTER);
    const hasRing = finalComponents.some(component => component.type === 'ring');

    setComponents(finalComponents);
    setRingClosed(hasRing);
    setFeedback(hasRing ? 'Círculo fechado. Lendo o glifo...' : 'Tempo esgotado. Lendo o desenho...');
    setFeedbackColor(hasRing ? '#88ff88' : '#ffcc66');

    setTimeout(() => {
      onGlyphComplete(finalComponents, precision, sourceStrokes);
    }, 350);

    return true;
  }, [onGlyphComplete]);

  const scheduleIdleFinalization = useCallback((sourceStrokes: DrawingStroke[]) => {
    const hasDetectedRing = sourceStrokes.some((stroke) => {
      const rawClosureDistance = stroke.rawClosureDistance ?? getClosureDistance(stroke.points);
      return analyzeStroke(closeStrokeIfNear(stroke.points, 42), CENTER).isRing &&
        rawClosureDistance < 42;
    });

    if (!hasDetectedRing || sourceStrokes.length < 2) return;

    if (finalizeIdleTimeoutRef.current !== null) {
      window.clearTimeout(finalizeIdleTimeoutRef.current);
    }

    finalizeIdleTimeoutRef.current = window.setTimeout(() => {
      finalizeGlyph(strokesRef.current);
    }, 1800);
  }, [finalizeGlyph]);

  const startStroke = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingEnabled || finalizingRef.current) return;
    e.preventDefault();
    if (finalizeIdleTimeoutRef.current !== null) {
      window.clearTimeout(finalizeIdleTimeoutRef.current);
      finalizeIdleTimeoutRef.current = null;
    }
    if (inkAvailable <= MIN_DRAW_INK) {
      setFeedback('A tinta acabou. Espere o proximo turno.');
      setFeedbackColor('#67e8f9');
      return;
    }
    activePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = getPointerPoint(e);
    setIsDrawing(true);
    setCurrentStroke([pos]);
    setFeedback('');
  }, [isDrawingEnabled, inkAvailable, getPointerPoint]);

  const continueStroke = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawingEnabled || finalizingRef.current) return;
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    e.preventDefault();
    const points = getCoalescedPointerPoints(e);
    let nextStroke = currentStroke;
    let ranDry = false;

    for (const pos of points) {
      const last = nextStroke[nextStroke.length - 1];
      if (!last) continue;

      const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
      if (dist < 3) continue;

      const spentInk = onInkDrag(dist);
      if (spentInk <= 0) {
        ranDry = true;
        break;
      }

      nextStroke = [...nextStroke, pos];
    }

    if (ranDry) {
      if (nextStroke.length >= 5) {
        const dryStroke = {
          id: crypto.randomUUID(),
          points: nextStroke,
          timestamp: Date.now(),
          rawClosureDistance: getClosureDistance(nextStroke),
        };
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

    if (nextStroke === currentStroke) return;
    setCurrentStroke(nextStroke);

    if (nextStroke.length > 30) {
      const quality = analyzeRingQuality(nextStroke, CENTER);
      const closeDist = quality.closureDistance;
      setClosureProgress(Math.round(quality.precision));

      if (quality.isPlausibleRing) {
        const analysis = analyzeStroke(closeStrokeIfNear(nextStroke, 35), CENTER);
        if (analysis.isRing) {
          setFeedback('Solte para fechar e revelar.');
          setFeedbackColor('#88ff88');
        }
      } else if (closeDist < 42) {
        setFeedback(`Quase la... (${Math.round(closeDist)}px)`);
        setFeedbackColor('#ffcc66');
      }
    }
  }, [isDrawing, isDrawingEnabled, currentStroke, strokes, getCoalescedPointerPoints, onInkDrag]);

  const endStroke = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    e.preventDefault();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    activePointerIdRef.current = null;
    setIsDrawing(false);
    setClosureProgress(0);

    if (currentStroke.length < 5) {
      setCurrentStroke([]);
      return;
    }

    const rawClosureDistance = getClosureDistance(currentStroke);
    const closedStroke = closeStrokeIfNear(currentStroke, 28);
    const nextStrokes = [...strokes, { id: crypto.randomUUID(), points: currentStroke, timestamp: Date.now(), rawClosureDistance }];
    strokesRef.current = nextStrokes;
    setStrokes(nextStrokes);

    const analysis = analyzeStroke(closedStroke, CENTER);
    if (analysis.isRing) {
      setRingClosed(true);
      setFeedback(nextStrokes.length > 1
        ? 'Circulo detectado. Aguarde ou continue refinando.'
        : 'Circulo detectado. Adicione glifos e chaves.');
      setFeedbackColor('#88ff88');
    }
    scheduleIdleFinalization(nextStrokes);

    setCurrentStroke([]);
  }, [isDrawing, currentStroke, strokes, scheduleIdleFinalization]);

  const reset = useCallback(() => {
    setStrokes([]);
    strokesRef.current = [];
    setCurrentStroke([]);
    setComponents([]);
    setRingClosed(false);
    setFeedback('');
    setClosureProgress(0);
    activePointerIdRef.current = null;
    finalizingRef.current = false;
    if (finalizeIdleTimeoutRef.current !== null) {
      window.clearTimeout(finalizeIdleTimeoutRef.current);
      finalizeIdleTimeoutRef.current = null;
    }
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

      ctx.fillStyle = '#d7bb82';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      const grad = ctx.createRadialGradient(CENTER.x, CENTER.y, 20, CENTER.x, CENTER.y, 250);
      grad.addColorStop(0, 'rgba(255, 238, 178, 0.52)');
      grad.addColorStop(0.62, 'rgba(200, 150, 85, 0.22)');
      grad.addColorStop(1, 'rgba(95, 48, 22, 0.18)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      ctx.fillStyle = 'rgba(82, 41, 18, 0.055)';
      for (let y = 24; y < CANVAS_SIZE; y += 28) {
        ctx.fillRect(28, y, CANVAS_SIZE - 56, 1);
      }

      ctx.beginPath();
      ctx.arc(CENTER.x, CENTER.y, IDEAL_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(92, 53, 23, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 14]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(CENTER.x, CENTER.y, 50, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(92, 53, 23, 0.16)';
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
        ctx.strokeStyle = '#7a461f';
        ctx.lineWidth = 4;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.strokeStyle = '#f6dda0';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      if (currentStroke.length > 1) {
        const closeDist = currentStroke.length > 30 ? getClosureDistance(currentStroke) : Infinity;
        const strokeColor = closeDist < 60 ? '#2f7d42' : '#2d1b12';

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

        if (closeDist < 60) {
          const first = currentStroke[0];
          const last = currentStroke[currentStroke.length - 1];
          ctx.beginPath();
          ctx.arc(first.x, first.y, closeDist, 0, Math.PI * 2);
          const proximityAlpha = Math.max(0, 0.3 - closeDist * 0.005);
          ctx.strokeStyle = `rgba(47, 125, 66, ${proximityAlpha})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(first.x, first.y);
          ctx.strokeStyle = `rgba(47, 125, 66, ${proximityAlpha * 0.5})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      if (closureProgress > 0 && !ringClosed) {
        ctx.beginPath();
        ctx.arc(CENTER.x, CENTER.y, 200, -Math.PI / 2, -Math.PI / 2 + (closureProgress / 100) * Math.PI * 2);
        ctx.strokeStyle = `rgba(47, 125, 66, ${closureProgress / 200})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (ringClosed) {
        ctx.beginPath();
        ctx.arc(CENTER.x, CENTER.y, 210, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(122, 70, 31, ${0.42 + Math.sin(time * 4) * 0.12})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time * 0.2;
        const x = CENTER.x + Math.cos(angle) * 230;
        const y = CENTER.y + Math.sin(angle) * 230;
        ctx.fillStyle = `rgba(92, 53, 23, ${0.18 + Math.sin(time + i) * 0.05})`;
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
        className={`w-full rounded-md border transition-all duration-300 ${
          ringClosed
            ? 'border-[#7a461f] shadow-[0_0_28px_rgba(122,70,31,0.28)]'
            : isDrawingEnabled
            ? 'border-[#8a592b]/50 shadow-[0_10px_30px_rgba(62,31,15,0.18)] hover:border-[#6f421c]/80'
            : 'border-[#7a461f]/35 opacity-80'
        }`}
        style={{ aspectRatio: '1', touchAction: 'none', cursor: QUILL_CURSOR }}
        onPointerDown={startStroke}
        onPointerMove={continueStroke}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
      />

      {feedback && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-sm text-sm font-medium whitespace-nowrap transition-all"
          style={{
            backgroundColor: 'rgba(49,31,18,0.86)',
            color: feedbackColor,
            textShadow: `0 0 8px ${feedbackColor}66`,
          }}
        >
          {feedback}
        </div>
      )}

      {elementName && isDrawingEnabled && (
        <div className="absolute top-3 left-3 px-2 py-1 rounded-sm text-xs bg-[#3b2114]/80 text-[#f5d98f] border border-[#7a461f]/50">
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
