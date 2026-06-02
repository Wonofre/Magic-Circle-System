# brain.md - Magic Circle TCG / Codex Project Brain

> Direcao central para Codex, agentes de codigo e humanos.  
> Projeto: **TCG de magia desenhada**, onde o jogador cria cartas desenhando circulos, glifos e signos com tinta magica.

---

## 1. Regras para o Codex

Antes de alterar qualquer arquivo, leia este documento inteiro.

1. Nao reescrever o projeto do zero sem necessidade.
2. Evoluir por modulos pequenos, tipados e testaveis.
3. O jogador desenha cartas/magias; nao transformar em menu comum de skills.
4. Rabisco nao pode virar magia valida.
5. Reconhecimento correto = forma + topologia + intencao + gramatica.
6. Parser deterministico e autoridade principal.
7. Vision/ML pode ajudar no futuro, mas nao deve substituir validacao estrutural.
8. MVP e **vs IA local**.
9. Online, arena RPG, drops/eventos e IA avancada sao fundacao futura.
10. Toda task deve preservar `npm run build`.
11. o resultado deve ser detalhado e resumido no final de cada tarefa que for concluida neste documento Brain na tarefa feita - pendencias que podem ter ficado também

---

## 2. Estado atual do repo

Stack detectada: React + TypeScript + Vite.

Arquivos atuais importantes:

- `src/App.tsx` - fluxo principal de jogo, estados de batalha, desenho, casting, turno inimigo, vitoria/derrota.
- `src/components/GameCanvas.tsx` - canvas de desenho, captura de strokes, fechamento do anel e finalizacao do glifo.
- `src/lib/magicSystem.ts` - definicoes de sigilos/signos, parametros geometricos e utilitarios de reconhecimento.
- `src/lib/spellEngine.ts` - resolucao de magia, inimigos, acoes de IA e magias pre-definidas.
- `src/types/magic.ts` - tipos centrais do dominio magico.
- `src/types/glyphTemplates.ts` - tipos do catalogo seed de glifos.
- `src/data/glyphTemplates.seed.json` - catalogo seed completo de glifos.
- `src/data/glyphTemplates.ts` - importacao validada do catalogo e helpers de consulta.

O projeto ja esta alem do template Vite inicial, mas o `README.md` ainda precisa ser substituido por uma visao real do jogo.

---

## 3. Arquivos gerados na conversa e destino recomendado

Estes foram criados localmente durante a conversa. Devem ser usados como fonte para o repo.

### `glyph_templates_v0_1.json`

Destino recomendado: `src/data/glyphTemplates.seed.json`.

Status: importado para o app na Fase 1.

Uso:
- catalogo tecnico de glifos;
- templates vetoriais normalizados em `0..100`;
- base para comparacao com desenho do jogador;
- inclui `id`, `family`, `semantic_role`, `strokes`, `ports`, `topology_signature` e thresholds.

### `glyph_sheet_v0_1.svg`

Destino recomendado: `docs/glyphs/glyph_sheet_seed.svg`.

Uso:
- folha visual para humanos;
- exemplos de como cada signo deve parecer;
- pode ser gerado em massa por codigo sem geracao de imagem.

### `glyph_sheet_viewer_v0_1.html`

Destino recomendado: `docs/glyphs/glyph_sheet_viewer.html`.

Uso:
- visualizador interativo dos glifos;
- busca por familia/tag;
- inspecao de JSON tecnico.

### `generate_glyph_sheet_v0_1.py`

Destino recomendado: `tools/generate_glyph_sheet.py`.

Uso:
- gerar SVG/HTML a partir do JSON;
- manter assets reproduziveis.

### `deep-research-report.md`

Destino recomendado: `docs/research/tcg_mvp_plan.md` e referencia de roadmap neste `brain.md`.

Uso:
- GDD tecnico do TCG de cartas desenhadas;
- Spell Compiler como modulo central;
- loadout de grimorio em vez de deck tradicional fixo;
- IA local que escolhe um grafo canonico e mostra stroke replay;
- telemetria, fundacao online autoritativa e arena futura.

### `deep-research-report (1).md`

Destino recomendado: `docs/research/free_draw_magic_recognition.md` e referencia de roadmap neste `brain.md`.

Uso:
- pesquisa de reconhecimento de desenho livre;
- defesa de pipeline hibrido com captura vetorial, gate de rabisco, topologia, matching e parser;
- separacao entre identidade do feitico e qualidade de execucao;
- metricas de false positive, calibracao, hard negatives e anti-exploit.

### `magic_glyph_visual_sheet_v0_1.zip`

Nao recomendado commitar no repo. Usar como release artifact se necessario.

---

## 4. Visao de produto

Pitch:

> Um TCG onde as cartas nao sao apenas colecionadas: elas sao desenhadas. Cada carta nasce de um circulo magico feito com tinta arcana. O sistema le a estrutura do desenho, compila sua intencao e transforma o resultado em uma magia jogavel. Desenhos precisos geram magias fortes e estaveis; desenhos mal feitos falham, vazam, erram o alvo ou voltam contra o conjurador.

MVP:

- Combate 1v1 contra IA.
- Jogador desenha magia/carta no canvas.
- Sistema reconhece moldura, fonte, elemento, acao, forma e alvo.
- Sistema compila a magia em uma carta.
- Recurso principal: **tinta magica**.
- IA tambem desenha sua magia; o jogo mostra o desenho da IA, nome e efeito.

Futuro:

- PvP online.
- Drops/eventos para infundir tinta.
- Arena RPG com puzzles e barreiras magicas.
- Grimorio/Codex com magias descobertas.
- Vision/ML como camada auxiliar de interpretacao.

---

## 5. Arquitetura tecnica alvo

Pipeline correto:

```txt
DrawingStroke[] com x/y/t e metadados opcionais
-> captura fiel de eventos coalescidos quando disponivel
-> normalizacao 0..100
-> limpeza, deduplicacao, simplificacao e resampling
-> detector de ruido/scribble/unknown
-> segmentacao em primitivas candidatas
-> template matching vetorial
-> validacao topologica
-> validacao de portas/conexoes
-> checagem de margem semantica
-> compilacao em SpellGraph
-> simulacao de fluxo de tinta
-> SpellCard
-> CastResult
-> telemetria de decisao, falha e replay
```

Pipeline proibido:

```txt
rabisco -> classificador escolhe o mais parecido -> magia forte
```

Decisao de arquitetura:

- A identidade do feitico vem do parse estrutural.
- A qualidade do desenho modula custo, estabilidade, potencia, duracao, risco e precisao.
- IA/Vision pode ordenar candidatos legais ou ajudar em debug, mas nao pode inventar interpretacao fora da ontologia valida.
- Preview pode ser rapido e permissivo; decisao final precisa ser deterministica e mais rigida.

---

## 6. Estrutura recomendada

```txt
src/
  data/
    glyphTemplates.seed.json
    spellRecipes.ts
    inkInfusions.ts
    balanceTables.ts

  lib/
    recognizer/
      normalizeStrokes.ts
      resampleStrokes.ts
      scribbleDetector.ts
      primitiveSegmenter.ts
      templateMatcher.ts
      topologyValidator.ts
      semanticMargin.ts
      graphCompiler.ts
      failureResolver.ts

    spell/
      spellCompiler.ts
      inkSimulator.ts
      enemySpellAI.ts
      enemyStrokeRenderer.ts
      spellHash.ts

    telemetry/
      recognitionTelemetry.ts

  components/
    GlyphDebugPanel.tsx
    SpellCardPreview.tsx
    EnemyCastPreview.tsx
    CodexPanel.tsx
    RecognitionHeatmap.tsx

  types/
    glyphTemplates.ts
    spellGraph.ts
    spellCard.ts
    recognition.ts
    ink.ts
    telemetry.ts
```

---

## 7. Conceitos centrais

### Glifo

Simbolo reconhecivel desenhado pelo jogador. Pode ser elemento, acao, forma, alvo, tempo, defesa ou risco.

### Moldura

Estrutura externa da carta/magia. Normalmente circulo, duplo circulo, triangulo, quadrado ou espiral.

### Tinta magica

Recurso/mana do jogo. A tinta nao e apenas custo; ela flui no desenho.

### SpellGraph

Grafo canonico compilado a partir dos glifos reconhecidos. Define fontes, conexoes, elementos, acoes, formas, alvos, riscos, estabilidade e fluxo.

### SpellCard

Carta jogavel resultante do `SpellGraph`.

### SpellHash

Hash deterministico da estrutura magica. Mesma estrutura deve gerar mesma magia.

### Spell Compiler

Modulo puro que recebe strokes e contexto de turno, valida estrutura, gera candidatos, compila `SpellGraph`, simula tinta e retorna `SpellCard` ou falha diegetica.

### Loadout de grimorio

Substitui um deck tradicional de cartas prontas no MVP. Define glifos conhecidos, receitas descobertas, tintas, catalisadores e limites de risco permitidos no combate.

---

## 8. Roadmap de acao para Codex

### Fase 0 - Organizacao

- [ ] Substituir README generico por README real do jogo.
- [x] Criar `docs/`.
- [x] Criar `docs/research/`.
- [x] Criar `docs/glyphs/`.
- [x] Adicionar este `brain.md`.
- [x] Garantir `npm run build` apos mudancas iniciais.

Criterio de aceite:
- estrutura base existe;
- docs principais foram movidos ou resumidos;
- build passa.

### Fase 1 - Catalogo tipado

- [x] Criar `src/types/glyphTemplates.ts`.
- [x] Criar `src/data/glyphTemplates.seed.json`.
- [x] Criar `src/data/glyphTemplates.ts`.
- [x] Criar helpers:
  - `getGlyphById(id)`;
  - `getGlyphsByFamily(family)`;
  - `getGlyphsByRole(role)`.
- [x] Validar shape do JSON.
- [x] Importar catalogo seed completo com 96 templates.

Criterio de aceite:
- build passa;
- templates importam;
- app consegue listar quantidade de templates;
- JSON invalido falha com erro claro.

### Fase 2 - Captura, normalizacao e resampling

- [x] Criar `src/types/recognition.ts`.
- [x] Criar `src/lib/recognizer/normalizeStrokes.ts`.
- [x] Converter strokes do canvas para espaco `0..100`.
- [x] Preservar `x/y/t` como minimo canonico.
- [x] Tratar `pressure`, `tilt`, `twist` e metadados de ponteiro como opcionais.
- [x] Criar `resampleStroke(points, n)`.
- [x] Criar `resampleGlyph(strokes, totalPoints)`.
- [x] Deduplicar pontos repetidos e lidar com strokes vazios.
- [x] Adicionar fixtures simples de strokes para testes futuros.

Criterio de aceite:
- funcao pura;
- sem dependencia de React;
- aceita strokes do `GameCanvas`;
- nao exige pressao/orientacao para funcionar;
- build passa.

### Fase 3 - Detector de ruido, scribble e unknown

- [x] Criar `scribbleDetector.ts`.
- [x] Calcular sinais basicos: tamanho, densidade, comprimento, auto-interseccoes aproximadas, numero de strokes e proporcao de ruido.
- [x] Criar outcome `UNKNOWN`/`SCRIBBLE` antes do matcher.
- [x] Definir thresholds iniciais conservadores.
- [x] Criar casos hard negative manuais: rabisco, circulo aberto, glifo incompleto, sobretraco excessivo.

Criterio de aceite:
- rabisco obvio nao entra como candidato forte;
- desenho vazio ou quase vazio falha cedo;
- falha retorna motivo legivel para debug.

### Fase 4 - Template matcher hibrido inicial

- [x] Criar `templateMatcher.ts`.
- [x] Comparar desenho normalizado contra templates.
- [x] Retornar top 5 candidatos.
- [x] Calcular confianca por template.
- [x] Calcular margem top-1/top-2.
- [x] Separar ranking local de decisao final.
- [x] Deixar extensivel para `$Q/$P`, DTW, Hu Moments ou Shape Context sem acoplar ao MVP.

Criterio de aceite:
- desenho parecido retorna candidato correto;
- candidato sem margem suficiente nao e aceito automaticamente;
- matcher sozinho nao gera magia valida.

### Fase 5 - Topology gate

- [x] Criar `topologyValidator.ts`.
- [x] Validar loops fechados.
- [x] Validar numero de strokes abertos/fechados.
- [x] Validar interseccoes esperadas.
- [x] Validar fechamento minimo.
- [x] Validar ruido desconectado.
- [x] Validar portas basicas do template.
- [x] Rejeitar candidato visualmente parecido, mas topologicamente errado.

Criterio de aceite:
- circulo aberto nao vira `FRAME_CIRCLE_CONTAINMENT`;
- glifo com loops errados e recusado;
- rabisco nao vira magia valida;
- retorno explica qual regra topologica falhou.

### Fase 6 - Margem semantica, calibracao e risco

- [x] Criar `semanticMargin.ts`.
- [x] Consolidar `min_confidence` e `min_semantic_margin` do template.
- [x] Aplicar thresholds por familia/papel e por risco da magia.
- [x] Criar niveis de outcome: `cast_clean`, `cast_weak`, `partial`, `miscast`, `fizzle`, `backfire`.
- [x] Registrar porque um candidato foi aceito, instavel ou recusado.

Criterio de aceite:
- top-1 baixo ou margem pequena gera instabilidade/falha, nao chute;
- glifos ofensivos ou perigosos podem exigir margem maior;
- debug mostra confianca, margem e razao da decisao.

### Fase 7 - Debug panel de reconhecimento

- [x] Criar `GlyphDebugPanel.tsx`.
- [x] Mostrar top candidatos, confianca, margem e falhas.
- [x] Mostrar checks topologicos por template.
- [x] Mostrar `UNKNOWN/SCRIBBLE` quando aplicavel.
- [x] Integrar em modo debug sem quebrar jogo atual.

Criterio de aceite:
- usuario entende por que a magia passou/falhou;
- painel ajuda balancear thresholds;
- UI nao substitui regra do compilador.

### Fase 8 - SpellGraph e gramatica minima

- [x] Criar `src/types/spellGraph.ts`.
- [x] Criar `graphCompiler.ts`.
- [x] Converter glifos reconhecidos em grafo.
- [x] Validar gramatica minima:
  - precisa de moldura;
  - precisa de fonte;
  - precisa de elemento;
  - precisa de acao ou forma;
  - precisa de alvo ou alvo padrao legal;
  - conexoes precisam respeitar portas.
- [x] Criar `spellHash` deterministico para o grafo canonico.

Criterio de aceite:
- `Fogo + Emitir + Projetil + Alvo` gera magia ofensiva;
- `Terra + Conter + Barreira` gera magia defensiva;
- sem moldura falha;
- grafos equivalentes geram mesmo `spellHash`.

Resultado:
- criados `src/types/spellGraph.ts` e `src/lib/recognizer/graphCompiler.ts`;
- `compileSpellGraph` recebe glifos reconhecidos, ordena canonicamente, cria nos/arestas, valida gramatica minima e gera `spellHash`;
- `semanticResultsToGraphInputs` prepara resultados semanticos aceitos para o grafo;
- alvo padrao legal e adicionado quando nao houver alvo explicito.

Pendencias:
- conexoes por portas ainda sao heuristicas e devem ficar mais rigorosas nas proximas fases;
- segmentacao multi-glifo real ainda depende de fases futuras;
- SpellGraph ainda nao resolve combate nem cria SpellCard.

### Fase 9 - SpellCard e Spell Compiler

- [x] Criar `src/types/spellCard.ts`.
- [x] Criar `src/lib/spell/spellCompiler.ts`.
- [x] Unificar normalizacao, matching, topologia, margem, grafo e tinta em uma API pura.
- [x] Retornar `SpellCard` ou falha tipada.
- [x] Separar identidade do feitico de qualidade de execucao.
- [x] Criar primeiros `spellRecipes.ts`.

Criterio de aceite:
- uma chamada pura compila strokes em carta ou falha;
- `App.tsx` ainda nao precisa ser refeito inteiro;
- resultado inclui nome, custo, estabilidade, potencia, alvo e falhas.

Resultado:
- criados `src/types/spellCard.ts`, `src/data/spellRecipes.ts` e `src/lib/spell/spellCompiler.ts`;
- `compileSpellFromStrokes` executa matcher, topologia, margem semantica e tenta compilar SpellGraph;
- `compileSpellCardFromSemanticResults` aceita multiplos resultados semanticos e gera `SpellCard` quando a gramatica minima fecha;
- `SpellCard` separa identidade (`graph`, `recipeId`, `componentTemplateIds`) de qualidade de execucao (`inkCost`, `stability`, `potency`, `recognitionOutcome`).

Pendencias:
- enquanto nao houver segmentacao multi-glifo, `compileSpellFromStrokes` tende a falhar em grafo incompleto para desenhos de glifo unico;
- custo de tinta ainda e calculado de forma simples, aguardando Fase 10;
- receitas iniciais sao minimas e servem como base para balanceamento posterior.

### Fase 10 - Tinta magica

- [x] Criar `src/types/ink.ts`.
- [x] Adicionar `ink`, `maxInk`, `inkRegenPerTurn` ao player e IA.
- [x] Criar `inkSimulator.ts`.
- [x] Alterar spell engine para consumir tinta.
- [x] Custo depende de complexidade, estabilidade, risco e infusao.
- [x] Modelar pureza, viscosidade, volatilidade e afinidade como campos futuros.

Criterio de aceite:
- magia forte tem custo real;
- tinta insuficiente gera falha clara;
- excesso de tinta pode gerar sobrecarga/backfire;
- item altera calculo, nao substitui desenho.

Resultado:
- criados `src/types/ink.ts` e `src/lib/spell/inkSimulator.ts`;
- `Entity` agora possui reservatorio de tinta com `ink`, `maxInk`, `inkRegenPerTurn`, pureza, viscosidade, volatilidade, afinidade e infusoes ativas;
- `spellEngine` calcula custo de tinta para magias procedurais, falha claramente quando a tinta e insuficiente e adiciona custo nas acoes da IA;
- `App.tsx` recebeu integracao minima para inicializar, exibir, gastar e regenerar tinta sem refatorar o fluxo principal.

Pendencias:
- sobrecarga/backfire por excesso de tinta ainda esta modelada como chance calculada, mas nao causa efeito de combate ate a Fase 11;
- infusoes ainda sao ids/campos futuros, aguardando `inkInfusions.ts` na Fase 16;
- o compilador novo de `SpellCard` ainda nao consome esta simulacao diretamente em combate porque a UI antiga continua usando `spellEngine`.

### Fase 11 - Falhas diegeticas

- [x] Criar `failureResolver.ts`.
- [x] Mapear falhas:
  - `fizzle`;
  - `miscast`;
  - `leak`;
  - `backfire`;
  - `wrong_target`;
  - `unknown`;
  - `overload`.
- [x] Severidade combina erro geometrico, topologia, ambiguidade, dinamica e tinta.
- [x] Backfire pode causar dano ao jogador.
- [x] Feedback deve apontar causa tecnica em linguagem diegetica.

Criterio de aceite:
- falha parece consequencia do desenho, nao aleatoriedade;
- cada falha tem mensagem clara e efeito de jogo previsivel;
- baixa confianca nao vira sucesso por conveniencia.

Resultado:
- criado `src/lib/recognizer/failureResolver.ts` como camada pura de resolucao de falhas;
- falhas `fizzle`, `miscast`, `leak`, `backfire`, `wrong_target`, `unknown` e `overload` agora retornam severidade, mensagem diegetica, causa tecnica, sinais numericos e efeito futuro de combate;
- severidade combina sinais de geometria, topologia, ambiguidade semantica, dinamica do traco e tinta;
- `SpellCompileFailure` agora pode carregar `diegeticFailure`;
- `spellCompiler.ts` anexa resolucao diegetica em rejeicao de reconhecimento, rejeicao semantica e grafo invalido;
- `npm run build` passa.

Pendencias:
- o fluxo visual antigo em `App.tsx` ainda nao consome `diegeticFailure`;
- dano real de `backfire`/`overload` ainda fica como `casterDamageHint` para ser aplicado quando o combate migrar para o compilador novo;
- `wrong_target` depende de issues de grafo e deve ficar mais rico quando conexoes/portas forem validadas com mais rigor.

### Fase 12 - IA que desenha

- [x] Criar `enemySpellAI.ts`.
- [x] Criar `enemyStrokeRenderer.ts`.
- [x] IA escolhe intencao tatica.
- [x] IA escolhe receita/grafo canonico.
- [x] IA gera strokes a partir dos templates com ruido controlado.
- [x] Criar perfis iniciais: `apprentice`, `aggressive`, `defensive`, `control`, `master`.
- [x] Criar `EnemyCastPreview.tsx`.
- [ ] Opcional em debug: passar desenho da IA pelo mesmo compilador para validar replay.

Criterio de aceite:
- turno inimigo mostra desenho da magia, nome e efeito;
- IA usa o mesmo vocabulario do jogador;
- IA nao improvisa fora da ontologia valida.

Resultado:
- criado `src/lib/spell/enemySpellAI.ts` para escolher perfil, intencao tatica, templates validos e SpellGraph canonico;
- criado `src/lib/spell/enemyStrokeRenderer.ts` para gerar strokes deterministas a partir dos templates com ruido controlado por perfil;
- criados perfis `apprentice`, `aggressive`, `defensive`, `control` e `master`;
- criado `src/components/EnemyCastPreview.tsx` para mostrar desenho, nome, custo/poder estimados, perfil e hash do grafo;
- `App.tsx` agora escolhe um plano de magia no turno inimigo, mostra o desenho e registra nome/efeito no log;
- `npm run build` passa.

Pendencias:
- o dano do turno inimigo ainda usa `getEnemyAction` legado para preservar balanceamento;
- o replay da IA ainda nao passa pelo `compileSpellFromStrokes` em modo debug;
- o preview aparece durante o turno inimigo, mas ainda nao anima stroke por stroke.

### Fase 13 - Grimorio/Codex e loadout

- [x] Criar `CodexPanel.tsx`.
- [x] Persistir magias descobertas por `spellHash`.
- [x] Mostrar desenho, nome, componentes, efeito e melhor precisao.
- [x] Criar loadout de grimorio com glifos conhecidos, receitas e tintas permitidas.
- [x] Diferenciar magia descoberta de magia dominada.

Criterio de aceite:
- jogador consegue rever cartas criadas;
- loadout limita o que pode ser compilado no duelo;
- Codex ajuda aprender sem virar menu comum de skills.

Resultado:
- criado `src/types/codex.ts` com entradas de Codex, estados de dominio e loadout;
- criado `src/lib/spell/codexStore.ts` para hash deterministico, persistencia em `localStorage`, upsert de descobertas e validacao do loadout;
- criado `src/components/CodexPanel.tsx` para listar magias por `spellHash`, componentes, efeito, melhor precisao, custo, usos e dominio;
- `App.tsx` agora abre o Codex no botao do grimorio, registra magias descobertas/conjuradas e impede conjuracao de componentes fora do loadout;
- `npm run build` passa.

Pendencias:
- o Codex ainda mostra representacao textual/componentes, nao replay vetorial completo do desenho do jogador;
- loadout inicial permite todos os glifos legados para preservar a jogabilidade atual;
- integracao direta com `SpellCard` novo esta pronta em helper, mas o combate visual ainda usa o motor legado.

### Fase 14 - Telemetria, metricas e hard negatives

- [x] Criar `recognitionTelemetry.ts`.
- [x] Registrar raw strokes, strokes normalizados, candidatos, margem, falhas, decisao final e contexto.
- [x] Medir falso positivo de rabiscos.
- [x] Medir falso negativo de desenhos validos.
- [x] Medir matriz de confusao por glifo/familia.
- [x] Criar fixture set de hard negatives.
- [x] Preparar metricas futuras: precision/recall/F1, Brier/log loss para modelos probabilisticos.

Criterio de aceite:
- cada decisao de reconhecimento pode ser auditada;
- regressao de falso positivo fica detectavel;
- dados nao dependem de React.

Resultado:
- criado `src/types/telemetry.ts` com eventos auditaveis, contexto, candidatos, fixtures negativos, resumo de metricas e matriz de confusao;
- criado `src/lib/telemetry/recognitionTelemetry.ts` para gerar eventos de reconhecimento, clonar strokes, resumir hard negatives e montar matriz de confusao;
- criado `hardNegativeFixtureSet` reaproveitando fixtures de vazio, rabisco, circulo aberto, glifo incompleto e sobretraco;
- `SpellCompileResult` agora pode carregar `telemetry`;
- `spellCompiler.ts` anexa telemetria em rejeicao inicial, rejeicao semantica, grafo invalido e sucesso;
- `npm run build` passa.

Pendencias:
- ainda nao ha tela dedicada para explorar a telemetria dentro do jogo;
- metricas de falso negativo para desenhos validos dependem de um fixture set positivo maior;
- Brier/log loss ficam apenas preparados conceitualmente ate existir modelo probabilistico calibrado.

### Fase 15 - Assistencia, UX e modos de habilidade

- [ ] Criar feedback de portas, loops e conexoes em tempo real.
- [ ] Criar ghost overlay opcional por primitiva valida.
- [ ] Criar modos `aprendiz` e `mestre`.
- [ ] Snap deve respeitar gramatica, nao apenas embelezar desenho.
- [ ] Preview pode usar eventos previstos; decisao final nao.

Criterio de aceite:
- jogador aprende por que falhou;
- assistencia nao aceita rabisco como magia;
- modo aprendiz reduz frustracao sem quebrar regra.

Resultado parcial - melhoria profunda de reconhecimento:
- corrigido matcher para normalizar templates e input no mesmo espaco antes da comparacao;
- matcher agora usa cache de templates, variantes controladas, score sequencial + point-cloud/chamfer e contexto de zona/tamanho;
- parser de mandala passou a reconhecer clusters multi-stroke maiores e limita matching aos glifos ativos do duelo;
- checks de topologia passaram a usar cantos, viradas e marcador de saida quando declarados no template;
- canvas nao finaliza mais imediatamente ao detectar o primeiro circulo; usa finalizacao por inatividade depois que ha moldura e conteudo;
- App usa fallback temporario via ponte legada quando o compilador novo falha, registrando telemetria de fallback;
- adicionados testes de regressao para 28 glifos ativos, variacoes humanas, glifos multi-stroke, negativos dificeis e fluxo de finalizacao;
- `npm test` e `npm run build` passam.

Resultado parcial - calibragem de sigilos/chaves e autoria SVG:
- criado `src/lib/recognizer/glyphTemplateCalibration.ts` para auditar cada glifo ativo um por um com variacoes sinteticas de jitter, rotacao, escala e direcao de traco;
- criado `src/lib/recognizer/glyphTemplateCalibration.test.ts` para impedir regressao de top-1, margem semantica e topologia nos glifos ativos;
- criado `src/lib/recognizer/svgGlyphTemplate.ts` para converter SVG simples em `GlyphTemplate` normalizado, facilitando a criacao de novos simbolos;
- criado `docs/glyphs/svg_template_authoring.md` com fluxo de criacao, importacao e calibragem de novos SVGs;
- `ELEMENT_AQUA` ganhou segunda ondulacao interna e assinatura `open_strokes: 2`, ficando mais separado de `ELEMENT_TERRA` e `ELEMENT_IGNIS`;
- `FORM_AURA` ganhou quatro marcas cardinais e assinatura `open_strokes: 4`, ficando mais separado de molduras circulares;
- previews do Guia, Codex e sigilos legados agora usam renderizacao compartilhada baseada no catalogo quando ha templateId mapeado;
- matcher passou a aplicar penalidade topologica leve no ranking, aumentando margem contra candidatos visualmente parecidos mas estruturalmente errados;
- `npm test` passa com 42 testes.

Pendencias:
- calibrar thresholds com desenhos reais de jogadores, nao apenas templates e perturbacoes sinteticas;
- reduzir custo do matcher em sessoes longas com cache por grupo/candidato ou pre-filtro mais agressivo;
- transformar fallback legado em modo debug/compatibilidade depois que o parser novo estiver estavel o bastante.

### Fase 16 - Infusoes e drops

- [ ] Criar `inkInfusions.ts`.
- [ ] Implementar infusoes iniciais:
  - Carmesim: dano + risco;
  - Orvalho Lunar: cura + purificacao;
  - Cristal Azul: precisao + reflexao;
  - Fuligem Abissal: drain + corrupcao;
  - Pena de Vendaval: movimento/vento.
- [ ] Aplicar infusao depois da compilacao base.
- [ ] Impedir que item mude a identidade primaria do desenho.

Criterio de aceite:
- item altera custo, potencia, status, risco ou afinidade;
- reconhecimento continua sob controle;
- infusao nao substitui desenho correto.

### Fase 17 - Online futuro

- [ ] Separar motor puro de UI.
- [ ] Garantir serializacao de `SpellGraph` e `SpellCard`.
- [ ] Criar `CastCommand`.
- [ ] Planejar validacao autoritativa no servidor.
- [ ] Cliente envia raw strokes e metadados; servidor recompila e resolve.
- [ ] Resultado retorna com replay e objeto canonico.

Criterio de aceite:
- mesmo input gera mesmo resultado;
- regra nao depende de estado visual do React;
- arquitetura nao bloqueia PvP autoritativo.

### Fase 18 - Arena RPG/puzzle futura

- [ ] Reusar `SpellCompiler` fora do duelo.
- [ ] Criar contexto de ambiente: barreiras, fogo, agua, vento, veneno, rotas e objetos.
- [ ] Mapear SpellCard para efeitos ambientais.
- [ ] Permitir puzzles com a mesma gramatica de glifos.

Criterio de aceite:
- arena nao cria segundo sistema de magia;
- desenhos validos do TCG continuam validos no ambiente quando fizer sentido;
- falhas continuam diegeticas.

### Fase 19 - Rework visual TCG e grimorio vivo

- [x] Criar `src/lib/ui/motionTokens.ts` com duracoes, curvas e niveis de intensidade por tipo de feedback.
- [x] Criar `src/lib/ui/themeTokens.ts` com paleta de papel, ouro, vinho, tinta e acentos elementais.
- [x] Criar `src/components/BattleSceneShell.tsx`.
- [x] Transformar a tela de combate em um livro aberto com duas paginas.
- [x] Mover HP, tinta, escudo, fraqueza e intencao para superficies proximas da area de foco.
- [x] Criar altar visual do oponente com retrato, recursos e trilha de intencao.
- [x] Transformar log de batalha em marginalia contextual de baixo ruido.
- [x] Substituir blocos utilitarios por superficies com textura, moldura e hierarquia editorial.

Criterio de aceite:
- combate lembra um duelo em grimorio, nao um prototipo com widgets;
- informacoes criticas ficam proximas ao foco principal;
- batalha continua legivel em 1 olhar;
- `npm run build` passa.

Resultado:
- criados `src/lib/ui/motionTokens.ts`, `src/lib/ui/themeTokens.ts` e `src/components/BattleSceneShell.tsx`;
- `App.tsx` agora renderiza o combate pelo shell de grimorio vivo, preservando `GameCanvas`, reconhecedor, parser, SpellCard e fluxo de combate;
- o canvas recebeu tratamento de papel/tinta para parecer uma pagina ativa do grimorio;
- o fundo antigo perdeu brilhos soltos e ganhou textura de mesa/tomo;
- adicionados ajustes responsivos para altar, paginas, tokens e VFX em telas estreitas;
- `npm run build` passa.

Pendencias:
- validar legibilidade em monitores menores e em mobile real;
- criar page flip/slide reduzido por fase sem atrapalhar input;
- revisar contraste fino depois de playtest visual.

### Fase 20 - Ritmo, telegraph e feedback cinematografico

- [x] Criar `src/lib/ui/turnPresentationDirector.ts`.
- [x] Reduzir cadeia de timeouts longos do `App.tsx` usando timings curtos centralizados.
- [x] Reduzir o toast de `SpellEffectDisplay` para confirmacao rapida.
- [x] Integrar uma camada visual de impacto na pagina ativa.
- [x] Manter opcao de pular/encurtar animacoes em debug com `?fastCombat=1`, `?skipMotion=1` ou `localStorage.fastCombat = "1"`.
- [x] Encurtar timings automaticamente quando `prefers-reduced-motion: reduce` estiver ativo.
- [ ] Migrar todos os timeouts restantes para uma timeline cancelavel por evento.
- [ ] Criar telegraph claro do turno inimigo com preview stroke-by-stroke.
- [ ] Fazer o feedback de sucesso, resistencia, escudo e cura acontecer inteiramente dentro da sequencia da magia.

Criterio de aceite:
- combate fica rapido o suficiente para manter flow;
- inimigo parece presente e inteligivel;
- feedback e bonito, mas nunca atrapalha a leitura;
- finishers podem ser mais longos, casts comuns nao.

Resultado:
- delays principais foram encurtados: impacto do jogador, avanco de fase, telegraph inimigo, resolucao inimiga e derrota;
- leitura do glifo passou a usar `turnPresentationTimings.glyphReadDelay`;
- o feedback lateral de magia deixou de segurar varios segundos.
- `turnPresentationDirector` agora escolhe timings normais, reduzidos ou rapidos por ambiente/debug.

Pendencias:
- calibrar timings com playtest;
- garantir sincronia exata entre dano aplicado e frame de impacto.

### Fase 21 - Magic VFX procedural por spellHash

- [x] Criar `src/lib/ui/spellVfxSeed.ts`.
- [x] Criar `src/lib/ui/spellVfxRecipes.ts`.
- [x] Criar `src/components/MagicVfxLayer.tsx`.
- [x] Usar `spellHash`, nome, sigilo primario e resultado para gerar assinatura visual deterministica.
- [x] Implementar fallback inicial em CSS/SVG/React, sem PixiJS.
- [x] Reaproveitar `PerfectGlyphPreview` para assinatura vetorial inicial do sigilo principal.
- [x] Ligar trajetoria/impacto basico ao alvo visual: dano projeta para inimigo; cura/escudo retorna para self.
- [ ] Implementar biblioteca completa de primitivas: line draw, ring pulse, ribbon, sparks, shockwave, residue, impact decal.
- [ ] Avaliar PixiJS apenas para efeitos mais pesados.

Criterio de aceite:
- novas magias parecem autorais sem animacao manual por magia;
- mesma magia sempre parece a mesma;
- VFX comunica funcao e elemento;
- performance continua aceitavel.

Resultado:
- criada camada procedural simples com seed deterministica e receita por tipo de resultado;
- VFX aparece sobre a pagina ativa durante cast e respeita `prefers-reduced-motion`.
- VFX agora inclui glyph preview vetorial e classe de alvo (`enemy`, `self`, `field`) para direcao visual.

Pendencias:
- adicionar replay vetorial real do glifo desenhado pelo jogador;
- revisar acessibilidade de flashes antes de efeitos dramaticos.

### Fase 22 - Unificacao de Guide, Grimoire e Codex

- [ ] Criar `src/components/CodexBook.tsx`.
- [ ] Unificar `GuidePanel`, `GrimoirePanel` e `CodexPanel` numa UI unica de grimorio.
- [ ] Criar paginas de descoberta com replay do glifo, maestria, efeito e assinatura visual.
- [ ] Criar paginas de tutorial dentro do mesmo livro, nao em superficies concorrentes.
- [ ] Dar tratamento de carta/lamina para cada magia descoberta.

Criterio de aceite:
- o jogador entende que aprende, descobre e arquiva magia no mesmo objeto;
- a colecao parece um TCG;
- a progressao de maestria fica clara e desejavel.

Pendencias:
- decidir se paginas usam paginacao real ou rolagem interna por secao;
- testar densidade de informacao de cada carta;
- conectar replay do glifo ao historico real do jogador no futuro.

---

## 9. Proximo prompt recomendado para Codex

```txt
Leia brain.md inteiro antes de alterar arquivos.

Tarefa: implementar Fase 11.

Objetivo: adicionar resolucao diegetica de falhas como camada pura e explicavel.

Requisitos:
- criar src/lib/recognizer/failureResolver.ts;
- mapear falhas fizzle, miscast, leak, backfire, wrong_target, unknown e overload;
- combinar erro geometrico, topologia, ambiguidade, dinamica e tinta;
- permitir backfire causar dano ao jogador em etapa futura;
- feedback deve apontar causa tecnica em linguagem diegetica;
- nao refatorar App.tsx ainda;
- garantir npm run build;
- ao final explicar arquivos alterados e proximos passos.
```

---

## 10. Definition of Done

Uma task so esta pronta se:

- `npm run build` passa;
- TypeScript passa;
- app ainda abre;
- mudanca e modular;
- reconhecimento nao ficou mais permissivo sem justificativa;
- erros dao feedback claro;
- logica pura pode ser testada fora da UI;
- rabiscos continuam recusaveis;
- decisoes importantes podem ser auditadas por debug/telemetria.

---

## 11. Filosofia final

A carta e o resultado do desenho.  
A tinta e recurso e materia fisica.  
O parser precisa saber recusar.  
A IA deve desenhar tambem.  
O mesmo desenho deve gerar o mesmo `spellHash`.  
Desenho melhor melhora potencia, custo, estabilidade ou precisao.  
Desenho errado causa falha compreensivel.  
O sistema deve parecer magico porque e coerente, nao porque aceita qualquer coisa.
