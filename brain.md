# brain.md — Magic Circle TCG / Codex Project Brain

> Direção central para Codex, agentes de código e humanos.  
> Projeto: **TCG de magia desenhada**, onde o jogador cria cartas desenhando círculos, glifos e signos com tinta mágica.

---

## 1. Regras para o Codex

Antes de alterar qualquer arquivo, leia este documento inteiro.

1. Não reescrever o projeto do zero sem necessidade.
2. Evoluir por módulos pequenos, tipados e testáveis.
3. O jogador desenha cartas/magias; não transformar em menu comum de skills.
4. Rabisco não pode virar magia válida.
5. Reconhecimento correto = forma + topologia + intenção + gramática.
6. Parser determinístico é autoridade principal.
7. Vision/ML pode ajudar no futuro, mas não deve substituir validação estrutural.
8. MVP é **vs IA local**.
9. Online, arena RPG, drops/eventos e IA avançada são fundação futura.
10. Toda task deve preservar `npm run build`.

---

## 2. Estado atual do repo

Stack detectada: React + TypeScript + Vite.

Arquivos atuais importantes:

- `src/App.tsx` — fluxo principal de jogo, estados de batalha, desenho, casting, turno inimigo, vitória/derrota.
- `src/components/GameCanvas.tsx` — canvas de desenho, captura de strokes, fechamento do anel e finalização do glifo.
- `src/lib/magicSystem.ts` — definições de sigilos/signos, parâmetros geométricos e utilitários de reconhecimento.
- `src/lib/spellEngine.ts` — resolução de magia, inimigos, ações de IA e magias pré-definidas.
- `src/types/magic.ts` — tipos centrais do domínio mágico.

O projeto já está além do template Vite inicial, mas o `README.md` ainda precisa ser substituído por uma visão real do jogo.

---

## 3. Arquivos gerados na conversa e destino recomendado

Estes foram criados localmente durante a conversa. Devem ser usados como fonte para o repo.

### `glyph_templates_v0_1.json`

Destino recomendado: `src/data/glyphTemplates.seed.json` ou `src/data/glyphTemplates.ts`.

Uso:
- catálogo técnico de glifos;
- templates vetoriais normalizados em `0..100`;
- base para comparação com desenho do jogador;
- inclui `id`, `family`, `semantic_role`, `strokes`, `ports`, `topology_signature` e thresholds.

### `glyph_sheet_v0_1.svg`

Destino recomendado: `docs/glyphs/glyph_sheet_seed.svg`.

Uso:
- folha visual para humanos;
- exemplos de como cada signo deve parecer;
- pode ser gerado em massa por código sem geração de imagem.

### `glyph_sheet_viewer_v0_1.html`

Destino recomendado: `docs/glyphs/glyph_sheet_viewer.html`.

Uso:
- visualizador interativo dos glifos;
- busca por família/tag;
- inspeção de JSON técnico.

### `generate_glyph_sheet_v0_1.py`

Destino recomendado: `tools/generate_glyph_sheet.py`.

Uso:
- gerar SVG/HTML a partir do JSON;
- manter assets reproduzíveis.

### `magic_glyph_visual_sheet_v0_1.zip`

Não recomendado commitar no repo. Usar como release artifact se necessário.

---

## 4. Visão de produto

Pitch:

> Um TCG onde as cartas não são apenas colecionadas: elas são desenhadas. Cada carta nasce de um círculo mágico feito com tinta arcana. O sistema lê a estrutura do desenho, compila sua intenção e transforma o resultado em uma magia jogável. Desenhos precisos geram magias fortes e estáveis; desenhos mal feitos falham, vazam, erram o alvo ou voltam contra o conjurador.

MVP:

- Combate 1v1 contra IA.
- Jogador desenha magia/carta no canvas.
- Sistema reconhece moldura, fonte, elemento, ação, forma e alvo.
- Sistema compila a magia em uma carta.
- Recurso principal: **tinta mágica**.
- IA também desenha sua magia; o jogo mostra o desenho da IA, nome e efeito.

Futuro:

- PvP online.
- Drops/eventos para infundir tinta.
- Arena RPG com puzzles e barreiras mágicas.
- Grimório/Codex com magias descobertas.
- Vision/ML como camada auxiliar de interpretação.

---

## 5. Arquitetura técnica alvo

Pipeline correto:

```txt
DrawingStroke[]
-> normalização 0..100
-> simplificação / resampling
-> template matching vetorial
-> validação topológica
-> validação de portas/conexões
-> compilação em SpellGraph
-> simulação de fluxo de tinta
-> SpellCard
-> CastResult
```

Pipeline proibido:

```txt
rabisco -> classificador escolhe o mais parecido -> magia forte
```

---

## 6. Estrutura recomendada

```txt
src/
  data/
    glyphTemplates.seed.json
    spellRecipes.ts
    inkInfusions.ts

  lib/
    recognizer/
      normalizeStrokes.ts
      resampleStrokes.ts
      templateMatcher.ts
      topologyValidator.ts
      graphCompiler.ts
      failureResolver.ts

    spell/
      spellCompiler.ts
      inkSimulator.ts
      enemySpellAI.ts

  components/
    GlyphDebugPanel.tsx
    SpellCardPreview.tsx
    EnemyCastPreview.tsx
    CodexPanel.tsx

  types/
    glyphTemplates.ts
    spellGraph.ts
    spellCard.ts
```

---

## 7. Conceitos centrais

### Glifo

Símbolo reconhecível desenhado pelo jogador. Pode ser elemento, ação, forma, alvo, tempo, defesa ou risco.

### Moldura

Estrutura externa da carta/magia. Normalmente círculo, duplo círculo, triângulo, quadrado ou espiral.

### Tinta mágica

Recurso/mana do jogo. A tinta não é apenas custo; ela flui no desenho.

### SpellGraph

Grafo compilado a partir dos glifos reconhecidos. Define fontes, conexões, elementos, ações, formas, alvos, riscos e estabilidade.

### SpellCard

Carta jogável resultante do `SpellGraph`.

### SpellHash

Hash determinístico da estrutura mágica. Mesma estrutura deve gerar mesma magia.

---

## 8. Roadmap de ação para Codex

### Fase 0 — Organização

- [ ] Substituir README genérico por README real do jogo.
- [ ] Criar `docs/`.
- [ ] Criar `docs/research/`.
- [ ] Criar `docs/glyphs/`.
- [ ] Adicionar este `brain.md`.
- [ ] Garantir `npm run build`.

### Fase 1 — Catálogo tipado

- [ ] Criar `src/types/glyphTemplates.ts`.
- [ ] Criar `src/data/glyphTemplates.seed.json`.
- [ ] Criar helpers:
  - `getGlyphById(id)`;
  - `getGlyphsByFamily(family)`;
  - `getGlyphsByRole(role)`.
- [ ] Validar shape do JSON.

Critério de aceite:
- build passa;
- templates importam;
- app consegue listar quantidade de templates.

### Fase 2 — Normalização e resampling

- [ ] Criar `normalizeStrokes.ts`.
- [ ] Converter strokes do canvas para espaço `0..100`.
- [ ] Criar `resampleStroke(points, n)`.
- [ ] Criar `resampleGlyph(strokes, totalPoints)`.

Critério de aceite:
- função pura;
- sem dependência de React;
- aceita strokes do `GameCanvas`.

### Fase 3 — Template matcher

- [ ] Criar `templateMatcher.ts`.
- [ ] Comparar desenho normalizado contra templates.
- [ ] Retornar top 5 candidatos.
- [ ] Calcular confiança e margem semântica.
- [ ] Criar classe `UNKNOWN/SCRIBBLE`.

Critério de aceite:
- desenho parecido retorna candidato correto;
- rabisco retorna baixa confiança.

### Fase 4 — Topology gate

- [ ] Criar `topologyValidator.ts`.
- [ ] Validar loops fechados.
- [ ] Validar número de strokes abertos/fechados.
- [ ] Validar interseções.
- [ ] Validar ruído excedente.
- [ ] Rejeitar candidato visualmente parecido, mas topologicamente errado.

Critério de aceite:
- círculo aberto não vira círculo fechado;
- glifo com loops errados é recusado;
- rabisco não vira magia válida.

### Fase 5 — Debug panel de reconhecimento

- [ ] Criar `GlyphDebugPanel.tsx`.
- [ ] Mostrar top candidatos, confiança, margem e falhas.
- [ ] Integrar em modo debug sem quebrar jogo atual.

Critério de aceite:
- usuário entende por que a magia passou/falhou.

### Fase 6 — SpellGraph

- [ ] Criar `spellGraph.ts`.
- [ ] Criar `graphCompiler.ts`.
- [ ] Converter glifos reconhecidos em grafo.
- [ ] Validar gramática mínima:
  - precisa de moldura;
  - precisa de elemento/fonte;
  - precisa de ação/forma;
  - precisa de alvo ou alvo padrão.

Critério de aceite:
- `Fogo + Emitir + Projétil + Alvo` gera magia ofensiva;
- `Terra + Conter + Barreira` gera magia defensiva;
- sem moldura falha.

### Fase 7 — Tinta mágica

- [ ] Adicionar `ink`, `maxInk`, `inkRegenPerTurn` ao player e IA.
- [ ] Alterar spell engine para consumir tinta.
- [ ] Custo depende de complexidade, estabilidade e infusão.

Critério de aceite:
- magia forte tem custo real;
- tinta insuficiente gera falha clara.

### Fase 8 — Falhas diegéticas

- [ ] Criar `failureResolver.ts`.
- [ ] Mapear falhas:
  - `fizzle`;
  - `miscast`;
  - `leak`;
  - `backfire`;
  - `wrong_target`.
- [ ] Backfire pode causar dano ao jogador.

Critério de aceite:
- falha parece consequência do desenho, não aleatoriedade.

### Fase 9 — IA que desenha

- [ ] Criar `enemySpellAI.ts`.
- [ ] IA escolhe intenção.
- [ ] IA escolhe receita.
- [ ] IA gera strokes a partir dos templates com ruído controlado.
- [ ] Criar `EnemyCastPreview.tsx`.

Critério de aceite:
- turno inimigo mostra desenho da magia, nome e efeito;
- IA usa o mesmo vocabulário do jogador.

### Fase 10 — Grimório/Codex

- [ ] Criar `CodexPanel.tsx`.
- [ ] Persistir magias descobertas por `spellHash`.
- [ ] Mostrar desenho, nome, componentes, efeito e melhor precisão.

Critério de aceite:
- jogador consegue rever cartas criadas.

### Fase 11 — Infusões e drops

- [ ] Criar `inkInfusions.ts`.
- [ ] Implementar infusões iniciais:
  - Carmesim: dano + risco;
  - Orvalho Lunar: cura + purificação;
  - Cristal Azul: precisão + reflexão;
  - Fuligem Abissal: drain + corrupção;
  - Pena de Vendaval: movimento/vento.

Critério de aceite:
- item altera cálculo, não substitui desenho.

### Fase 12 — Online futuro

- [ ] Separar motor puro de UI.
- [ ] Garantir serialização de `SpellGraph` e `SpellCard`.
- [ ] Criar `CastCommand`.
- [ ] Planejar validação autoritativa no servidor.

---

## 9. Próximo prompt recomendado para Codex

```txt
Leia brain.md inteiro antes de alterar arquivos.

Tarefa: implementar Fase 1.

Objetivo: importar o catálogo seed de glifos para o projeto React + TypeScript.

Requisitos:
- criar src/types/glyphTemplates.ts;
- criar src/data/glyphTemplates.seed.json;
- criar src/data/glyphTemplates.ts com helpers getGlyphById, getGlyphsByFamily, getGlyphsByRole;
- não refatorar App.tsx ainda;
- garantir npm run build;
- ao final explicar arquivos alterados e próximos passos.
```

---

## 10. Definition of Done

Uma task só está pronta se:

- `npm run build` passa;
- TypeScript passa;
- app ainda abre;
- mudança é modular;
- reconhecimento não ficou mais permissivo sem justificativa;
- erros dão feedback claro;
- lógica pura pode ser testada fora da UI.

---

## 11. Filosofia final

A carta é o resultado do desenho.  
A tinta é recurso e matéria física.  
O parser precisa saber recusar.  
A IA deve desenhar também.  
O mesmo desenho deve gerar o mesmo `spellHash`.  
Desenho melhor melhora potência, custo, estabilidade ou precisão.  
Desenho errado causa falha compreensível.
