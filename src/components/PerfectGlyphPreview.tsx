import type { SigilType, SignType, Point } from '@/types/magic';
import type { ReactNode } from 'react';
import { getCanonicalSymbolStrokes, SIGILS } from '@/lib/magicSystem';
import { getGlyphById } from '@/data/glyphTemplates';
import { getTemplateIdForLegacySigil } from '@/data/magicOntology';

type PreviewMode =
  | { mode: 'sigil'; type: SigilType }
  | { mode: 'sign'; type: SignType }
  | { mode: 'spell'; sigils: SigilType[]; signs: SignType[] };

interface PerfectGlyphPreviewProps {
  size?: number;
  className?: string;
  showRing?: boolean;
  strokeWidth?: number;
}

const DEFAULT_COLOR = '#f7d77a';
const SIGN_COLOR = '#d9a7ff';

function toPath(points: Point[], centerX: number, centerY: number, scale: number): string {
  if (points.length === 0) return '';
  return points
    .map((point, index) => {
      const x = centerX + point.x * scale;
      const y = centerY + point.y * scale;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function transformStroke(stroke: Point[], centerX: number, centerY: number, scale: number, rotation = 0): Point[] {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return stroke.map(point => ({
    x: centerX + (point.x * cos - point.y * sin) * scale,
    y: centerY + (point.x * sin + point.y * cos) * scale,
  }));
}

function renderStrokePath(stroke: Point[], key: string, color: string, strokeWidth: number, opacity = 1) {
  return (
    <path
      key={key}
      d={toPath(stroke, 0, 0, 1)}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}

function getCatalogStrokesForLegacySigil(type: SigilType): Point[][] | null {
  const templateId = getTemplateIdForLegacySigil(type);
  const glyph = templateId ? getGlyphById(templateId) : undefined;
  if (!glyph) return null;

  const points = glyph.strokes.flat();
  const minX = Math.min(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxX = Math.max(...points.map(([x]) => x));
  const maxY = Math.max(...points.map(([, y]) => y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;
  const scale = Math.max(width, height) / 2;

  return glyph.strokes.map((stroke) =>
    stroke.map(([x, y]) => ({
      x: (x - centerX) / scale,
      y: (y - centerY) / scale,
    })),
  );
}

function getSigilPreviewStrokes(type: SigilType): Point[][] {
  return getCatalogStrokesForLegacySigil(type) ?? getCanonicalSymbolStrokes('sigil', type);
}

export function PerfectGlyphPreview(props: PerfectGlyphPreviewProps & PreviewMode) {
  const { size = 84, className = '', showRing = false, strokeWidth = 4 } = props;
  const center = size / 2;
  const ringRadius = size * 0.41;
  const glowId = `glyphGlow-${props.mode}-${'type' in props ? props.type : `${props.sigils.join('-')}-${props.signs.join('-')}`}`;
  const paths: ReactNode[] = [];

  if (props.mode === 'sigil') {
    const color = SIGILS[props.type].glowColor;
    getSigilPreviewStrokes(props.type).forEach((stroke, index) => {
      paths.push(renderStrokePath(transformStroke(stroke, center, center, size * 0.25), `sigil-${index}`, color, strokeWidth));
    });
  }

  if (props.mode === 'sign') {
    getCanonicalSymbolStrokes('sign', props.type).forEach((stroke, index) => {
      paths.push(renderStrokePath(transformStroke(stroke, center, center, size * 0.25), `sign-${index}`, SIGN_COLOR, strokeWidth));
    });
  }

  if (props.mode === 'spell') {
    const primaryColor = SIGILS[props.sigils[0] ?? 'fire'].glowColor;
    props.sigils.slice(0, 3).forEach((sigil, sigilIndex) => {
      const offset = props.sigils.length === 1
        ? { x: 0, y: 0 }
        : {
            x: Math.cos((-Math.PI / 2) + sigilIndex * ((Math.PI * 2) / props.sigils.length)) * size * 0.11,
            y: Math.sin((-Math.PI / 2) + sigilIndex * ((Math.PI * 2) / props.sigils.length)) * size * 0.11,
          };
      getSigilPreviewStrokes(sigil).forEach((stroke, strokeIndex) => {
        paths.push(renderStrokePath(
          transformStroke(stroke, center + offset.x, center + offset.y, size * 0.13),
          `spell-sigil-${sigil}-${strokeIndex}`,
          SIGILS[sigil].glowColor,
          strokeWidth * 0.72,
        ));
      });
    });

    props.signs.slice(0, 6).forEach((sign, signIndex) => {
      const count = Math.min(6, Math.max(1, props.signs.length));
      const angle = -Math.PI / 2 + signIndex * ((Math.PI * 2) / count);
      const signCenterX = center + Math.cos(angle) * size * 0.25;
      const signCenterY = center + Math.sin(angle) * size * 0.25;
      getCanonicalSymbolStrokes('sign', sign).forEach((stroke, strokeIndex) => {
        paths.push(renderStrokePath(
          transformStroke(stroke, signCenterX, signCenterY, size * 0.105, angle),
          `spell-sign-${signIndex}-${sign}-${strokeIndex}`,
          SIGN_COLOR,
          strokeWidth * 0.62,
          0.92,
        ));
      });
    });

    paths.push(
      <circle
        key="inner-ring"
        cx={center}
        cy={center}
        r={size * 0.17}
        fill="none"
        stroke={primaryColor}
        strokeWidth={Math.max(1, strokeWidth * 0.26)}
        opacity={0.2}
      />,
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx={center} cy={center} r={ringRadius} fill="rgba(255, 214, 122, 0.035)" />
      {(showRing || props.mode === 'spell') && (
        <>
          <circle cx={center} cy={center} r={ringRadius} fill="none" stroke={DEFAULT_COLOR} strokeWidth={Math.max(1, strokeWidth * 0.44)} opacity={0.78} />
          <circle cx={center} cy={center} r={ringRadius * 0.82} fill="none" stroke={DEFAULT_COLOR} strokeWidth={Math.max(1, strokeWidth * 0.18)} opacity={0.22} strokeDasharray="4 7" />
        </>
      )}
      <g filter={`url(#${glowId})`}>{paths}</g>
    </svg>
  );
}
