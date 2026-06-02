import type {
  GlyphFamily,
  GlyphRecognitionConfig,
  GlyphSemanticRole,
  GlyphStrokes,
  GlyphTemplate,
  GlyphTopologySignature,
} from "@/types/glyphTemplates";

interface SvgPoint {
  readonly x: number;
  readonly y: number;
}

interface SvgBounds {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

export interface SvgGlyphParseOptions {
  readonly normalization?: "viewBox" | "bounds";
  readonly curveSteps?: number;
  readonly circleSteps?: number;
}

export interface SvgGlyphParseResult {
  readonly strokes: GlyphStrokes;
  readonly diagnostics: readonly string[];
}

export interface SvgGlyphTemplateInput {
  readonly id: string;
  readonly displayName: string;
  readonly family: GlyphFamily;
  readonly semanticRole: GlyphSemanticRole;
  readonly description: string;
  readonly ports?: readonly string[];
  readonly topologySignature: GlyphTopologySignature;
  readonly recognition?: Partial<GlyphRecognitionConfig>;
  readonly tags?: readonly string[];
}

const DEFAULT_RECOGNITION: GlyphRecognitionConfig = {
  method: "svg_template_plus_topology",
  min_confidence: 0.76,
  min_semantic_margin: 0.16,
  recommended_recognizers: ["$Q/$P point-cloud", "SVG path distance", "topology gate"],
  reject_if: [
    "missing_required_loop",
    "too_many_noise_strokes",
    "wrong_port_connection",
    "ambiguous_with_neighbor_template",
  ],
};

const numberPattern = "-?\\d*\\.?\\d+(?:e[-+]?\\d+)?";
const attributePattern = (name: string): RegExp =>
  new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");

const readAttribute = (tag: string, name: string): string | null =>
  tag.match(attributePattern(name))?.[1] ?? null;

const readNumberAttribute = (tag: string, name: string, fallback = 0): number => {
  const value = readAttribute(tag, name);
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parsePointsAttribute = (value: string | null): SvgPoint[] => {
  if (!value) return [];
  const values = value.match(new RegExp(numberPattern, "gi"))?.map(Number) ?? [];
  const points: SvgPoint[] = [];

  for (let index = 0; index < values.length - 1; index += 2) {
    points.push({ x: values[index], y: values[index + 1] });
  }

  return points;
};

const parseViewBox = (svg: string): SvgBounds => {
  const tag = svg.match(/<svg\b[^>]*>/i)?.[0] ?? "";
  const viewBox = readAttribute(tag, "viewBox");
  const values = viewBox?.match(new RegExp(numberPattern, "gi"))?.map(Number);

  if (values && values.length >= 4 && values[2] > 0 && values[3] > 0) {
    return {
      minX: values[0],
      minY: values[1],
      width: values[2],
      height: values[3],
    };
  }

  const width = readNumberAttribute(tag, "width", 100);
  const height = readNumberAttribute(tag, "height", 100);
  return {
    minX: 0,
    minY: 0,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
};

const getPointBounds = (strokes: readonly SvgPoint[][]): SvgBounds => {
  const points = strokes.flat();
  if (points.length === 0) {
    return { minX: 0, minY: 0, width: 100, height: 100 };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

const normalizeStrokes = (
  strokes: readonly SvgPoint[][],
  bounds: SvgBounds,
): GlyphStrokes => {
  const scale = 100 / Math.max(bounds.width, bounds.height);
  const offsetX = (100 - bounds.width * scale) / 2;
  const offsetY = (100 - bounds.height * scale) / 2;

  return strokes
    .map((stroke) =>
      stroke.map((point) => [
        Number((offsetX + (point.x - bounds.minX) * scale).toFixed(2)),
        Number((offsetY + (point.y - bounds.minY) * scale).toFixed(2)),
      ] as const),
    )
    .filter((stroke) => stroke.length > 0);
};

const makeEllipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  steps: number,
): SvgPoint[] =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;
    return {
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    };
  });

const cubicAt = (
  a: SvgPoint,
  b: SvgPoint,
  c: SvgPoint,
  d: SvgPoint,
  t: number,
): SvgPoint => {
  const mt = 1 - t;
  return {
    x: mt ** 3 * a.x + 3 * mt ** 2 * t * b.x + 3 * mt * t ** 2 * c.x + t ** 3 * d.x,
    y: mt ** 3 * a.y + 3 * mt ** 2 * t * b.y + 3 * mt * t ** 2 * c.y + t ** 3 * d.y,
  };
};

const quadraticAt = (
  a: SvgPoint,
  b: SvgPoint,
  c: SvgPoint,
  t: number,
): SvgPoint => {
  const mt = 1 - t;
  return {
    x: mt ** 2 * a.x + 2 * mt * t * b.x + t ** 2 * c.x,
    y: mt ** 2 * a.y + 2 * mt * t * b.y + t ** 2 * c.y,
  };
};

const tokenizePath = (path: string): string[] =>
  path.match(new RegExp(`[MmLlHhVvCcQqZz]|${numberPattern}`, "g")) ?? [];

const isCommand = (token: string | undefined): boolean => Boolean(token && /^[a-z]$/i.test(token));

const parsePath = (path: string, curveSteps: number, diagnostics: string[]): SvgPoint[][] => {
  const tokens = tokenizePath(path);
  const strokes: SvgPoint[][] = [];
  let index = 0;
  let command = "";
  let current: SvgPoint = { x: 0, y: 0 };
  let start: SvgPoint = { x: 0, y: 0 };
  let stroke: SvgPoint[] = [];

  const read = () => Number(tokens[index++]);
  const hasNumber = () => index < tokens.length && !isCommand(tokens[index]);
  const point = (x: number, y: number, relative: boolean): SvgPoint =>
    relative ? { x: current.x + x, y: current.y + y } : { x, y };
  const pushStroke = () => {
    if (stroke.length > 0) strokes.push(stroke);
    stroke = [];
  };

  while (index < tokens.length) {
    if (isCommand(tokens[index])) {
      command = tokens[index++];
    }

    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();

    if (upper === "M") {
      const next = point(read(), read(), relative);
      pushStroke();
      current = next;
      start = next;
      stroke.push(next);
      command = relative ? "l" : "L";
    } else if (upper === "L") {
      while (hasNumber()) {
        current = point(read(), read(), relative);
        stroke.push(current);
      }
    } else if (upper === "H") {
      while (hasNumber()) {
        current = relative ? { ...current, x: current.x + read() } : { ...current, x: read() };
        stroke.push(current);
      }
    } else if (upper === "V") {
      while (hasNumber()) {
        current = relative ? { ...current, y: current.y + read() } : { ...current, y: read() };
        stroke.push(current);
      }
    } else if (upper === "C") {
      while (hasNumber()) {
        const controlA = point(read(), read(), relative);
        const controlB = point(read(), read(), relative);
        const end = point(read(), read(), relative);
        for (let step = 1; step <= curveSteps; step += 1) {
          stroke.push(cubicAt(current, controlA, controlB, end, step / curveSteps));
        }
        current = end;
      }
    } else if (upper === "Q") {
      while (hasNumber()) {
        const control = point(read(), read(), relative);
        const end = point(read(), read(), relative);
        for (let step = 1; step <= curveSteps; step += 1) {
          stroke.push(quadraticAt(current, control, end, step / curveSteps));
        }
        current = end;
      }
    } else if (upper === "Z") {
      stroke.push(start);
      current = start;
      pushStroke();
    } else {
      diagnostics.push(`Comando SVG path "${command}" ignorado. Converta arcos/curvas complexas para M/L/C/Q/Z.`);
      while (hasNumber()) index += 1;
    }
  }

  pushStroke();
  return strokes;
};

export const svgToGlyphStrokes = (
  svg: string,
  options: SvgGlyphParseOptions = {},
): SvgGlyphParseResult => {
  const curveSteps = options.curveSteps ?? 12;
  const circleSteps = options.circleSteps ?? 48;
  const diagnostics: string[] = [];
  const rawStrokes: SvgPoint[][] = [];

  for (const tag of svg.match(/<(path|polyline|polygon|line|circle|ellipse|rect)\b[^>]*>/gi) ?? []) {
    const name = tag.match(/^<\s*(\w+)/)?.[1]?.toLowerCase();

    if (name === "path") {
      const path = readAttribute(tag, "d");
      if (path) rawStrokes.push(...parsePath(path, curveSteps, diagnostics));
    }

    if (name === "polyline" || name === "polygon") {
      const points = parsePointsAttribute(readAttribute(tag, "points"));
      if (name === "polygon" && points.length > 0) rawStrokes.push([...points, points[0]]);
      else rawStrokes.push(points);
    }

    if (name === "line") {
      rawStrokes.push([
        { x: readNumberAttribute(tag, "x1"), y: readNumberAttribute(tag, "y1") },
        { x: readNumberAttribute(tag, "x2"), y: readNumberAttribute(tag, "y2") },
      ]);
    }

    if (name === "circle") {
      const r = readNumberAttribute(tag, "r");
      rawStrokes.push(makeEllipse(
        readNumberAttribute(tag, "cx"),
        readNumberAttribute(tag, "cy"),
        r,
        r,
        circleSteps,
      ));
    }

    if (name === "ellipse") {
      rawStrokes.push(makeEllipse(
        readNumberAttribute(tag, "cx"),
        readNumberAttribute(tag, "cy"),
        readNumberAttribute(tag, "rx"),
        readNumberAttribute(tag, "ry"),
        circleSteps,
      ));
    }

    if (name === "rect") {
      const x = readNumberAttribute(tag, "x");
      const y = readNumberAttribute(tag, "y");
      const width = readNumberAttribute(tag, "width");
      const height = readNumberAttribute(tag, "height");
      rawStrokes.push([
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
        { x, y },
      ]);
    }
  }

  if (rawStrokes.length === 0) {
    diagnostics.push("Nenhum path/polyline/polygon/line/circle/ellipse/rect encontrado no SVG.");
  }

  const bounds = options.normalization === "bounds" ? getPointBounds(rawStrokes) : parseViewBox(svg);
  return {
    strokes: normalizeStrokes(rawStrokes, bounds),
    diagnostics,
  };
};

export const glyphTemplateFromSvg = (
  svg: string,
  input: SvgGlyphTemplateInput,
  options?: SvgGlyphParseOptions,
): GlyphTemplate => {
  const { strokes } = svgToGlyphStrokes(svg, options);

  return {
    id: input.id,
    display_name: input.displayName,
    family: input.family,
    semantic_role: input.semanticRole,
    description: input.description,
    strokes,
    ports: input.ports ?? [],
    topology_signature: input.topologySignature,
    recognition: {
      ...DEFAULT_RECOGNITION,
      ...input.recognition,
      recommended_recognizers:
        input.recognition?.recommended_recognizers ?? DEFAULT_RECOGNITION.recommended_recognizers,
      reject_if: input.recognition?.reject_if ?? DEFAULT_RECOGNITION.reject_if,
    },
    tags: input.tags ?? [],
  };
};
