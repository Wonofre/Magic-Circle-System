# Autoria de Glifos por SVG

Este fluxo permite criar novos glifos em SVG e convertê-los para o formato reconhecível do catálogo (`strokes` normalizados em `0..100`).

## Fonte de verdade

- O catálogo ativo fica em `src/data/glyphTemplates.seed.json`.
- A validação tipada fica em `src/data/glyphTemplates.ts`.
- O conversor SVG fica em `src/lib/recognizer/svgGlyphTemplate.ts`.
- A auditoria de reconhecimento fica em `src/lib/recognizer/glyphTemplateCalibration.ts`.
- Os previews de Guia/Codex usam `src/components/GlyphTemplatePreview.tsx`.

## Como desenhar um SVG novo

Use `viewBox="0 0 100 100"` sempre que possível. O importador aceita:

- `path` com comandos `M/L/H/V/C/Q/Z`;
- `polyline`;
- `polygon`;
- `line`;
- `circle`;
- `ellipse`;
- `rect`.

Evite paths com arco `A` exportado automaticamente. Se o editor gerar arcos, converta para curvas cúbicas ou use `circle`/`ellipse`.

Exemplo:

```svg
<svg viewBox="0 0 100 100">
  <path d="M 50 18 L 78 50 L 50 82 L 22 50 Z" />
  <path d="M 30 70 L 70 70" />
</svg>
```

## Como transformar em template

Use `glyphTemplateFromSvg(svg, metadata)` e depois copie o resultado para `glyphTemplates.seed.json`.

Campos mínimos importantes:

- `id`: único, em caixa alta, ex. `ELEMENT_NOVO`.
- `family` e `semanticRole`: precisam existir em `src/types/glyphTemplates.ts`.
- `topologySignature`: loops, traços abertos, interseções e geometria dominante.
- `recognition.min_confidence` e `recognition.min_semantic_margin`: comece em `0.76` e `0.16`.

## Como calibrar

Depois de adicionar ou alterar um glifo:

1. Adicione o template à ontologia em `src/data/magicOntology.ts`.
2. Rode `npm test`.
3. Se a auditoria falhar, olhe `recognizedTemplateId`, `runnerUpTemplateId`, `margin` e `topologyValid`.
4. Prefira ajustar a silhueta/topologia do SVG antes de reduzir thresholds.
5. Rode `npm run build`.

## Mudanças calibradas

- `ELEMENT_AQUA`: ganhou segunda ondulação interna e passou a declarar `open_strokes: 2`, separando água de terra/fogo em variações esticadas.
- `FORM_AURA`: ganhou quatro marcas cardinais curtas e passou a declarar `open_strokes: 4`, separando aura de molduras circulares.
