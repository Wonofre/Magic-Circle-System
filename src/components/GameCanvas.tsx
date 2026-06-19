import { Suspense, lazy, useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { getGlyphById } from '@/data/glyphTemplates';
import { fitCircleToPoints } from '@/lib/geometry/circleFit';
import type { Point, DrawingStroke, PrecisionBreakdown } from '@/types/magic';
import {
  analyzeCastingCircleGesture,
  analyzeMandalaCanvasStrokesV2,
  buildMandalaLiveHintV2,
  closeStrokeIfNearV2,
  getStrokeClosureDistance,
} from '@/lib/recognizerV2/canvasFeedbackV2';
import { TUTORIAL_STEPS } from '@/components/CodexBook';
import { GlyphCollectorPanel } from '@/components/GlyphCollectorPanel';
import { drawingStrokesToRecognitionStrokes } from '@/lib/spell/strokeAdapter';

interface GameCanvasProps {
  onGlyphComplete: (precision: PrecisionBreakdown, strokes: DrawingStroke[]) => void;
  isDrawingEnabled: boolean;
  glowColor: string;
  elementName: string;
  inkAvailable: number;
  onInkDrag: (distance: number) => number;
  onInkRefund: (distance: number) => void;
  tutorialMode?: boolean;
  tutorialStep?: number;
  mlLoading?: boolean;
  onExitTutorial?: () => void;
}

const CANVAS_SIZE = 520;
const CENTER = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };
const IDEAL_RADIUS = 160;
const MIN_OUTER_CIRCLE_RADIUS = 90;
const MIN_DRAW_INK = 0.03;
const TUTORIAL_KEY_CENTER = { x: 360, y: 260 };
const TUTORIAL_KEY_SCOPE_RADIUS = 42;
const TUTORIAL_SIGIL_SCOPE_RADIUS = 52;
const TUTORIAL_STEP_MARKERS = [
  { step: 1, x: 260, y: 78 },
  { step: 2, x: 260, y: 260 },
  { step: 3, x: 330, y: 220 },
  { step: 4, x: 360, y: 260 },
  { step: 5, x: 310, y: 260 },
  { step: 6, x: 200, y: 160 },
] as const;
const getPathLength = (points: readonly Point[]): number =>
  points.reduce((total, point, index) => {
    const previous = points[index - 1];
    return previous ? total + Math.hypot(point.x - previous.x, point.y - previous.y) : total;
  }, 0);
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

const isGlyphCollectorEnabled = () => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('glyphCollector') === '1';
};

const isOuterCastingCircleGesture = (points: readonly Point[]): boolean => {
  const closedPoints = closeStrokeIfNearV2(points, 28);
  const fit = fitCircleToPoints(closedPoints);
  if (!fit || fit.radius < MIN_OUTER_CIRCLE_RADIUS) return false;

  const centerDistance = Math.hypot(fit.center.x - CENTER.x, fit.center.y - CENTER.y);
  return (
    analyzeCastingCircleGesture(closedPoints).isPlausibleCastingCircle &&
    centerDistance <= Math.max(65, fit.radius * 0.5)
  );
};

const drawTracePath = (
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  color = 'rgba(31, 113, 153, 0.62)',
) => {
  const first = points[0];
  if (!first) return;

  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.strokeStyle = 'rgba(225, 247, 255, 0.72)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
};

const drawGlyphTrace = (
  ctx: CanvasRenderingContext2D,
  templateId: string,
  center: Point,
  scale: number,
) => {
  const glyph = getGlyphById(templateId);
  if (!glyph) return;

  glyph.strokes.forEach((stroke) => {
    drawTracePath(
      ctx,
      stroke.map(([x, y]) => ({
        x: center.x + (x - 50) * scale,
        y: center.y + (y - 50) * scale,
      })),
    );
  });
};

const drawCircleTrace = (
  ctx: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  color = 'rgba(31, 113, 153, 0.62)',
) => {
  const points = Array.from({ length: 97 }, (_, index) => {
    const angle = (index / 96) * Math.PI * 2;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  });
  drawTracePath(ctx, points, color);
};

const drawTutorialTraceGuide = (ctx: CanvasRenderingContext2D) => {
  drawCircleTrace(ctx, CENTER, TUTORIAL_SIGIL_SCOPE_RADIUS);
  drawGlyphTrace(ctx, 'ELEMENT_AQUA', CENTER, 0.78);

  drawCircleTrace(ctx, TUTORIAL_KEY_CENTER, TUTORIAL_KEY_SCOPE_RADIUS);
  drawGlyphTrace(ctx, 'FORM_PROJECTILE', TUTORIAL_KEY_CENTER, 0.72);

  const channel = [
    { x: CENTER.x + TUTORIAL_SIGIL_SCOPE_RADIUS, y: CENTER.y },
    { x: TUTORIAL_KEY_CENTER.x, y: TUTORIAL_KEY_CENTER.y },
  ];
  drawTracePath(ctx, channel);
  drawCircleTrace(ctx, CENTER, IDEAL_RADIUS, 'rgba(166, 92, 25, 0.68)');
};

export function GameCanvas({
  onGlyphComplete,
  isDrawingEnabled,
  glowColor,
  elementName,
  inkAvailable,
  onInkDrag,
  onInkRefund,
  tutorialMode = false,
  tutorialStep = 1,
  mlLoading = false,
  onExitTutorial,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackColor, setFeedbackColor] = useState('#c9a23b');
  const [ringClosed, setRingClosed] = useState(false);
  const [closureProgress, setClosureProgress] = useState(0);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const animationRef = useRef<number>(0);
  const castBurstAtRef = useRef<number | null>(null);
  const strokesRef = useRef<DrawingStroke[]>([]);
  const finalizingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const [glyphDebugEnabled] = useState(isGlyphDebugEnabled);
  const [glyphCollectorEnabled] = useState(isGlyphCollectorEnabled);
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
    setIsFinalizing(true);

    const analysis = analyzeMandalaCanvasStrokesV2(sourceStrokes);
    const hasRing = analysis.hasCastingCircle;

    setRingClosed(hasRing);
    setFeedback(hasRing ? 'Mandala enviada. Lendo os simbolos...' : 'Mandala enviada sem um circulo externo reconhecido.');
    setFeedbackColor(hasRing ? '#88ff88' : '#ffcc66');

    setTimeout(() => {
      onGlyphComplete(analysis.precision, sourceStrokes);
    }, 350);

    return true;
  }, [onGlyphComplete]);

  const startStroke = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingEnabled || finalizingRef.current) return;
    e.preventDefault();
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
          rawClosureDistance: getStrokeClosureDistance(nextStroke),
        };
        const nextStrokes = [...strokes, dryStroke];
        strokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
      } else {
        onInkRefund(getPathLength(nextStroke));
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
      const quality = analyzeCastingCircleGesture(nextStroke);
      const closeDist = quality.closureDistance;
      setClosureProgress(Math.round(quality.precision));

      if (quality.isPlausibleCastingCircle) {
        setFeedback(isOuterCastingCircleGesture(nextStroke)
          ? 'Solte para fechar o circulo externo e conjurar.'
          : 'Solte para fechar este circulo.');
        setFeedbackColor('#88ff88');
      } else if (closeDist < 42) {
        setFeedback(`Quase la... (${Math.round(closeDist)}px)`);
        setFeedbackColor('#ffcc66');
      }
    }
  }, [isDrawing, isDrawingEnabled, currentStroke, strokes, getCoalescedPointerPoints, onInkDrag, onInkRefund]);

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

    if (currentStroke.length < 3 || getPathLength(currentStroke) < 4) {
      onInkRefund(getPathLength(currentStroke));
      setCurrentStroke([]);
      return;
    }

    const rawClosureDistance = getStrokeClosureDistance(currentStroke);
    const closedStroke = closeStrokeIfNearV2(currentStroke, 28);
    const nextStrokes = [...strokes, {
      id: crypto.randomUUID(),
      points: [...closedStroke],
      timestamp: Date.now(),
      rawClosureDistance,
    }];
    strokesRef.current = nextStrokes;
    setStrokes(nextStrokes);
    setCurrentStroke([]);

    if (isOuterCastingCircleGesture(closedStroke)) {
      setRingClosed(true);
      setFeedback('Circulo externo fechado. Conjurando...');
      setFeedbackColor('#88ff88');
      finalizeGlyph(nextStrokes);
      return;
    }

    if (analyzeCastingCircleGesture(closedStroke).isPlausibleCastingCircle) {
      setFeedback('Circulo local fechado. Continue a formula.');
      setFeedbackColor('#88ff88');
      return;
    }

    const liveHint = buildMandalaLiveHintV2(nextStrokes);
    setFeedback(liveHint.message);
    setFeedbackColor(
      liveHint.severity === 'ok' ? '#88ff88' : liveHint.severity === 'warn' ? '#ffcc66' : '#c8d8ff',
    );
  }, [isDrawing, currentStroke, strokes, onInkRefund, finalizeGlyph]);

  const undoLastStroke = useCallback(() => {
    if (!isDrawingEnabled || finalizingRef.current) return;
    const sourceStrokes = strokesRef.current;
    const removed = sourceStrokes[sourceStrokes.length - 1];
    if (!removed) {
      setFeedback('Nao ha tracos para desfazer.');
      setFeedbackColor('#ffcc66');
      return;
    }

    const nextStrokes = sourceStrokes.slice(0, -1);
    strokesRef.current = nextStrokes;
    setStrokes(nextStrokes);
    onInkRefund(getPathLength(removed.points));
    setRingClosed(nextStrokes.some((stroke) => isOuterCastingCircleGesture(stroke.points)));
    setFeedback('Ultimo traco desfeito.');
    setFeedbackColor('#f5d98f');
  }, [isDrawingEnabled, onInkRefund]);

  const clearDrawing = useCallback(() => {
    if (!isDrawingEnabled || finalizingRef.current) return;
    const removedDistance = strokesRef.current.reduce(
      (total, stroke) => total + getPathLength(stroke.points),
      0,
    );
    strokesRef.current = [];
    setStrokes([]);
    setCurrentStroke([]);
    setRingClosed(false);
    setClosureProgress(0);
    onInkRefund(removedDistance);
    setFeedback('Pagina limpa.');
    setFeedbackColor('#f5d98f');
  }, [isDrawingEnabled, onInkRefund]);

  const reset = useCallback(() => {
    setStrokes([]);
    strokesRef.current = [];
    setCurrentStroke([]);
    setRingClosed(false);
    setFeedback('');
    setClosureProgress(0);
    setIsFinalizing(false);
    activePointerIdRef.current = null;
    finalizingRef.current = false;
  }, []);

  useEffect(() => {
    if (!isDrawingEnabled) return;
    finalizingRef.current = false;
    setIsFinalizing(false);
    if (strokesRef.current.length > 0) {
      setFeedback('Tentativa preservada. Desfaca o circulo externo, ajuste e feche-o novamente.');
      setFeedbackColor('#f5d98f');
    }
  }, [isDrawingEnabled]);

  useEffect(() => {
    const handleUndoShortcut = (event: KeyboardEvent) => {
      if (!isDrawingEnabled || event.defaultPrevented) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      undoLastStroke();
    };

    window.addEventListener('keydown', handleUndoShortcut);
    return () => window.removeEventListener('keydown', handleUndoShortcut);
  }, [isDrawingEnabled, undoLastStroke]);

  useEffect(() => {
    const windowWithCanvas = window as unknown as Record<string, unknown>;
    windowWithCanvas.__resetCanvas = reset;
    windowWithCanvas.__finalizeCanvas = () => finalizeGlyph(strokesRef.current);
  }, [reset, finalizeGlyph]);

  useEffect(() => {
    if (ringClosed) {
      castBurstAtRef.current = performance.now();
      return;
    }
    castBurstAtRef.current = null;
  }, [ringClosed]);

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

      ctx.fillStyle = '#e8d4a8';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      const grad = ctx.createRadialGradient(CENTER.x, CENTER.y, 20, CENTER.x, CENTER.y, 250);
      grad.addColorStop(0, 'rgba(255, 245, 210, 0.55)');
      grad.addColorStop(0.62, 'rgba(212, 184, 122, 0.24)');
      grad.addColorStop(1, 'rgba(120, 72, 32, 0.16)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      ctx.fillStyle = 'rgba(82, 41, 18, 0.055)';
      for (let y = 24; y < CANVAS_SIZE; y += 28) {
        ctx.fillRect(28, y, CANVAS_SIZE - 56, 1);
      }

      if (tutorialMode) {
        drawTutorialTraceGuide(ctx);
        TUTORIAL_STEP_MARKERS.forEach(({ step, x, y }) => {
          const active = step === tutorialStep;
          ctx.beginPath();
          ctx.arc(x, y, active ? 15 : 11, 0, Math.PI * 2);
          ctx.fillStyle = active ? 'rgba(14, 116, 144, 0.92)' : 'rgba(45, 77, 91, 0.72)';
          ctx.fill();
          if (active) {
            ctx.strokeStyle = 'rgba(186, 230, 253, 0.95)';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.fillStyle = '#f8e7b0';
          ctx.font = active ? 'bold 14px sans-serif' : 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(step), x, y + 0.5);
        });
      } else {
        ctx.beginPath();
        ctx.arc(CENTER.x, CENTER.y, IDEAL_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(166, 124, 61, 0.28)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 14]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(CENTER.x, CENTER.y, 50, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(166, 124, 61, 0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

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
        ctx.strokeStyle = '#0f3048';
        ctx.lineWidth = 4;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.strokeStyle = '#2d6a8f';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      if (currentStroke.length > 1) {
        const closeDist = currentStroke.length > 30 ? getStrokeClosureDistance(currentStroke) : Infinity;
        const strokeColor = closeDist < 60 ? '#2f7d42' : '#1a4a6b';

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
        const sealPulse = 0.55 + Math.sin(time * 5) * 0.15;
        ctx.beginPath();
        ctx.arc(CENTER.x, CENTER.y, 210, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(26, 74, 107, ${sealPulse})`;
        ctx.lineWidth = 3.5;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(CENTER.x, CENTER.y, 205, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(232, 200, 106, ${0.28 + Math.sin(time * 3) * 0.1})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        const burstAt = castBurstAtRef.current;
        if (burstAt !== null) {
          const burstAge = (performance.now() - burstAt) / 1000;
          if (burstAge < 1.4) {
            for (let wave = 0; wave < 3; wave += 1) {
              const waveT = Math.max(0, burstAge - wave * 0.18);
              const radius = 40 + waveT * 220;
              const alpha = Math.max(0, 0.55 - waveT * 0.42);
              if (alpha <= 0) continue;
              ctx.beginPath();
              ctx.arc(CENTER.x, CENTER.y, radius, 0, Math.PI * 2);
              ctx.strokeStyle = wave % 2 === 0
                ? `rgba(45, 106, 143, ${alpha})`
                : `rgba(232, 200, 106, ${alpha * 0.6})`;
              ctx.lineWidth = 2.5 - wave * 0.5;
              ctx.stroke();
            }
            const bloom = ctx.createRadialGradient(CENTER.x, CENTER.y, 0, CENTER.x, CENTER.y, 80 + burstAge * 120);
            bloom.addColorStop(0, `rgba(45, 106, 143, ${Math.max(0, 0.35 - burstAge * 0.3)})`);
            bloom.addColorStop(0.5, `rgba(232, 200, 106, ${Math.max(0, 0.12 - burstAge * 0.1)})`);
            bloom.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = bloom;
            ctx.beginPath();
            ctx.arc(CENTER.x, CENTER.y, 80 + burstAge * 120, 0, Math.PI * 2);
            ctx.fill();
          }
        }
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
  }, [strokes, currentStroke, ringClosed, closureProgress, glowColor, tutorialMode, tutorialStep]);

  return (
    <div className="relative w-full max-w-[520px] mx-auto">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className={`w-full rounded-md border transition-all duration-300 ${
          ringClosed
            ? 'border-[#1a4a6b] shadow-[0_0_36px_rgba(45,106,143,0.38),0_0_12px_rgba(232,200,106,0.18)]'
            : isDrawingEnabled
            ? 'border-[#a67c3d]/45 shadow-[0_10px_30px_rgba(62,31,15,0.16)] hover:border-[#1a4a6b]/50'
            : 'border-[#a67c3d]/35 opacity-80'
        }`}
        style={{ aspectRatio: '1', touchAction: 'none', cursor: QUILL_CURSOR }}
        onPointerDown={startStroke}
        onPointerMove={continueStroke}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
      />

      {mlLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-[#1a1208]/55 backdrop-blur-[1px]">
          <div className="rounded-md border border-sky-800/35 bg-sky-950/80 px-4 py-3 text-center shadow-lg">
            <p className="text-sm font-semibold text-sky-100">Lendo os simbolos...</p>
            <p className="mt-1 text-[11px] text-sky-200/75">
              O grimorio neural desperta na primeira conjuracao.
            </p>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className="absolute bottom-14 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-sm text-sm font-medium whitespace-nowrap transition-all"
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

      {tutorialMode && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-sky-800/35 bg-sky-950/25 px-3 py-2">
          <p className="text-[11px] leading-relaxed text-sky-900">
            <strong>Passo {tutorialStep}:</strong>{' '}
            {TUTORIAL_STEPS.find((step) => step.id === tutorialStep)?.title ?? 'Siga o guia no canvas.'}
          </p>
          {onExitTutorial && (
            <button
              type="button"
              onClick={onExitTutorial}
              className="shrink-0 rounded border border-sky-800/35 px-2 py-1 text-[10px] font-semibold text-sky-900 hover:bg-sky-900/10"
            >
              Sair
            </button>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={undoLastStroke}
          disabled={!isDrawingEnabled || strokes.length === 0 || isFinalizing}
          className="flex items-center justify-center gap-1.5 rounded-md border border-[#8a592b]/35 bg-[#ead09a]/55 px-3 py-2 text-xs font-semibold text-[#563119] transition hover:bg-[#e2c17e] disabled:cursor-not-allowed disabled:opacity-40"
          title="Desfazer ultimo traco (Ctrl+Z)"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Desfazer
        </button>
        <button
          type="button"
          onClick={clearDrawing}
          disabled={!isDrawingEnabled || strokes.length === 0 || isFinalizing}
          className="flex items-center justify-center gap-1.5 rounded-md border border-[#8a592b]/35 bg-[#ead09a]/55 px-3 py-2 text-xs font-semibold text-[#563119] transition hover:bg-[#e2c17e] disabled:cursor-not-allowed disabled:opacity-40"
          title="Limpar a pagina"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Limpar
        </button>
      </div>

      {glyphDebugEnabled && (
        <Suspense fallback={null}>
          <GlyphDebugPanel strokes={debugStrokes} />
        </Suspense>
      )}
      {glyphCollectorEnabled && (
        <GlyphCollectorPanel
          strokes={drawingStrokesToRecognitionStrokes(debugStrokes)}
        />
      )}
    </div>
  );
}
