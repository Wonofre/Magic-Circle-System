import type { GlyphSemanticRole, GlyphTemplate } from "@/types/glyphTemplates";

export interface GlyphPreviewLayout {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

interface TemplateGlyphMarkProps {
  readonly glyph: GlyphTemplate;
  readonly layoutOverride?: GlyphPreviewLayout;
  readonly opacity?: number;
  readonly strokeWidth?: number;
}

interface GlyphTemplatePreviewProps {
  readonly glyph: GlyphTemplate;
  readonly size?: number;
  readonly className?: string;
  readonly strokeWidth?: number;
}

export const roleLayout: Record<GlyphSemanticRole, GlyphPreviewLayout> = {
  container: { x: 40, y: 40, size: 72 },
  source: { x: 40, y: 40, size: 13 },
  connector: { x: 40, y: 40, size: 36 },
  element: { x: 40, y: 39, size: 28 },
  derived: { x: 40, y: 39, size: 28 },
  action: { x: 23, y: 40, size: 19 },
  form: { x: 57, y: 40, size: 19 },
  target: { x: 40, y: 58, size: 17 },
  defense: { x: 40, y: 57, size: 24 },
  time: { x: 22, y: 22, size: 15 },
  risk: { x: 58, y: 22, size: 15 },
  ink: { x: 40, y: 22, size: 15 },
};

const roleStrokeClass: Record<GlyphSemanticRole, string> = {
  container: "text-amber-500",
  source: "text-cyan-300",
  connector: "text-amber-300/70",
  element: "text-orange-300",
  derived: "text-sky-300",
  action: "text-red-300",
  form: "text-purple-300",
  target: "text-emerald-300",
  defense: "text-sky-300",
  time: "text-yellow-200",
  risk: "text-red-400",
  ink: "text-cyan-400",
};

export const getGlyphBounds = (glyph: GlyphTemplate) => {
  const points = glyph.strokes.flat();
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
};

export function TemplateGlyphMark({
  glyph,
  layoutOverride,
  opacity = 0.95,
  strokeWidth,
}: TemplateGlyphMarkProps) {
  const bounds = getGlyphBounds(glyph);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const layout = layoutOverride ?? roleLayout[glyph.semantic_role];
  const scale = layout.size / Math.max(width, height);
  const offsetX = layout.x - (width * scale) / 2;
  const offsetY = layout.y - (height * scale) / 2;
  const project = ([x, y]: readonly [number, number]) =>
    `${offsetX + (x - bounds.minX) * scale},${offsetY + (y - bounds.minY) * scale}`;

  return (
    <g className={roleStrokeClass[glyph.semantic_role]}>
      {glyph.strokes.map((stroke, index) => (
        <polyline
          key={`${glyph.id}-${index}`}
          points={stroke.map(project).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth ?? (glyph.semantic_role === "container" ? 3.1 : 2.35)}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={glyph.semantic_role === "connector" ? Math.min(opacity, 0.62) : opacity}
        />
      ))}
    </g>
  );
}

export function GlyphTemplatePreview({
  glyph,
  size = 58,
  className = "overflow-visible",
  strokeWidth = 3.4,
}: GlyphTemplatePreviewProps) {
  const bounds = getGlyphBounds(glyph);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const pad = 10;
  const scale = (size - pad * 2) / Math.max(width, height);
  const offsetX = (size - width * scale) / 2;
  const offsetY = (size - height * scale) / 2;
  const project = ([x, y]: readonly [number, number]) =>
    `${offsetX + (x - bounds.minX) * scale},${offsetY + (y - bounds.minY) * scale}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden="true">
      {glyph.strokes.map((stroke, index) => (
        <polyline
          key={`${glyph.id}-${index}`}
          points={stroke.map(project).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
