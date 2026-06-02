# Generated Artifacts Manifest

Este arquivo lista os artefatos gerados na conversa e como eles devem ser usados no projeto.

## Arquivos adicionados ao repositório

### `brain.md`

Documento principal para Codex e agentes de código.

Contém:

- visão do projeto;
- regras para Codex;
- arquitetura alvo;
- roadmap;
- ordem de tasks;
- Definition of Done;
- prompt recomendado para próximas tarefas.

### `src/data/glyphTemplates.seed.json`

Catálogo seed de glifos para o MVP.

Contém templates vetoriais normalizados para:

- molduras;
- fontes;
- canais;
- elementos primários;
- ações;
- formas;
- alvos.

Cada item inclui:

- id;
- display_name;
- family;
- semantic_role;
- description;
- strokes;
- ports;
- topology_signature;
- recognition;
- tags.

### `docs/glyphs/glyph_sheet_seed.svg`

Folha visual SVG seed com exemplos dos glifos essenciais.

Uso:

- documentação visual;
- referência de desenho para humanos;
- validação visual rápida dos templates.

### `docs/glyphs/glyph_sheet_viewer_seed.html`

Viewer HTML simples para inspecionar os glifos seed.

Uso:

- abrir via dev server;
- buscar glifos por família;
- visualizar SVG e spec técnico.

### `docs/glyphs/svg_template_authoring.md`

Guia operacional para criar novos glifos a partir de SVG.

Contem:

- formatos SVG aceitos pelo importador;
- campos minimos de `GlyphTemplate`;
- ordem recomendada para adicionar template, ontologia e testes;
- notas de calibragem para `ELEMENT_AQUA` e `FORM_AURA`.

### `src/lib/recognizer/svgGlyphTemplate.ts`

Conversor de SVG para `GlyphTemplate`.

Uso:

- normalizar SVGs para strokes `0..100`;
- facilitar criacao de novos simbolos sem editar pontos manualmente;
- manter topologia e thresholds explicitos no catalogo.

### `src/lib/recognizer/glyphTemplateCalibration.ts`

Auditoria de reconhecimento dos glifos ativos.

Uso:

- testar cada glifo ativo com variacoes controladas;
- medir top-1, runner-up, confianca, margem e topologia;
- impedir regressao quando sigilos/chaves forem redesenhados.

### `docs/research/free_draw_magic_recognition.md`

Resumo técnico da pesquisa sobre reconhecimento de desenho livre.

Contém:

- pipeline recomendado;
- métodos avaliados;
- links de referência;
- topology gate;
- falhas mágicas;
- métricas.

### `docs/research/tcg_mvp_plan.md`

Plano de MVP para o TCG de magia desenhada.

Contém:

- objetivo do MVP;
- loop principal;
- arquitetura recomendada;
- componentes de carta;
- tinta mágica;
- IA desenhando;
- online futuro;
- arena RPG futura;
- ordem de implementação.

## Arquivos gerados localmente, mas não commitados integralmente

Os arquivos completos locais eram maiores e foram mantidos como referência para copiar ou usar como release artifact:

- `glyph_templates_v0_1.json` — catálogo completo com aproximadamente 96 glifos.
- `glyph_sheet_v0_1.svg` — folha visual completa.
- `glyph_sheet_viewer_v0_1.html` — viewer completo.
- `generate_glyph_sheet_v0_1.py` — script completo.
- `magic_glyph_visual_sheet_v0_1.zip` — pacote completo.

Motivo para não commitar todos integralmente agora:

- o repo precisa começar com um seed estável;
- arquivos grandes devem entrar depois de validar estrutura;
- o ZIP não é fonte ideal para versionamento;
- o Codex deve primeiro implementar tipos e pipeline com o seed.

## Próximo passo recomendado

Rodar a Fase 1 do `brain.md`:

1. Criar `src/types/glyphTemplates.ts`.
2. Criar `src/data/glyphTemplates.ts`.
3. Importar `glyphTemplates.seed.json`.
4. Criar helpers de acesso.
5. Garantir `npm run build`.

Depois disso, avançar para:

1. normalização de strokes;
2. template matcher;
3. topology gate;
4. debug panel no canvas.
