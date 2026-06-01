# TCG MVP Plan — Magic Circle System

Este documento resume o plano para evoluir o projeto para um TCG em que o jogador desenha as próprias cartas.

## Objetivo do MVP

Criar uma batalha local contra IA onde:

- o jogador desenha um círculo mágico;
- o sistema reconhece glifos e signos;
- o desenho é compilado em uma carta/magia;
- a carta consome tinta mágica;
- a IA também gera um desenho visível para sua magia;
- o resultado da batalha é resolvido por um motor determinístico.

## Loop principal

1. Começa turno do jogador.
2. Jogador tem uma quantidade de tinta mágica.
3. Jogador desenha no canvas.
4. O sistema normaliza os strokes para coordenadas 0..100.
5. O sistema compara com templates.
6. O sistema valida topologia e gramática.
7. O sistema compila um SpellGraph.
8. O SpellGraph vira uma SpellCard.
9. A carta é resolvida no combate.
10. A IA gera sua própria magia usando os mesmos templates.
11. O desenho da IA é exibido junto com nome e efeitos.

## Arquitetura recomendada

```txt
DrawingStroke[]
-> normalizeStrokes
-> resampleStrokes
-> templateMatcher
-> topologyValidator
-> graphCompiler
-> inkSimulator
-> spellEngine
```

## Pastas recomendadas

```txt
src/data/glyphTemplates.seed.json
src/types/glyphTemplates.ts
src/types/spellGraph.ts
src/types/spellCard.ts
src/lib/recognizer/normalizeStrokes.ts
src/lib/recognizer/resampleStrokes.ts
src/lib/recognizer/templateMatcher.ts
src/lib/recognizer/topologyValidator.ts
src/lib/recognizer/graphCompiler.ts
src/lib/spell/inkSimulator.ts
src/lib/spell/enemySpellAI.ts
src/components/GlyphDebugPanel.tsx
src/components/EnemyCastPreview.tsx
src/components/CodexPanel.tsx
```

## Componentes da carta desenhada

- Moldura: define estabilidade e escopo.
- Fonte: origem da tinta.
- Elemento: fogo, água, vento, terra, luz, sombra.
- Ação: emitir, conter, cortar, mover, restaurar, selar.
- Forma: projétil, barreira, onda, campo, armadilha.
- Alvo: único, área, self, aliado, inimigo, terreno.
- Risco: vazamento, rachadura, curto, ambiguidade.

## Tinta mágica

A tinta substitui mana. Ela deve ser tratada como recurso e como matéria do desenho.

Campos sugeridos:

- currentInk;
- maxInk;
- inkRegenPerTurn;
- inkQuality;
- inkInstability;
- activeInfusionIds.

## Falhas esperadas

- Fizzle: o desenho apaga sem efeito relevante.
- Miscast: a magia sai parcial ou com alvo ruim.
- Leak: a tinta vaza e reduz eficiência.
- Backfire: o circuito volta contra o conjurador.
- Unknown: o desenho é recusado como rabisco ou ambíguo.

## IA desenhando

A IA deve usar o mesmo catálogo de glifos do jogador.

Fluxo:

```txt
intent -> recipe -> glyph templates -> noisy strokes -> SpellGraph -> visible cast
```

Perfis iniciais:

- apprentice: mais erro;
- aggressive: prioriza ataque;
- defensive: prioriza barreira;
- control: prioriza status e alvo;
- master: baixa instabilidade.

## Online futuro

Preparar desde já:

- SpellGraph serializável;
- SpellCard serializável;
- spellHash determinístico;
- motor de resolução puro, sem depender de React;
- CastCommand para envio futuro ao servidor.

## Arena RPG futura

A arena virá depois do MVP. Ela deve usar os mesmos glifos para resolver desafios ambientais como luz, barreira, movimento, fogo, corte e transformação.

## Ordem de implementação

1. Catálogo seed de glifos.
2. Tipos TypeScript dos templates.
3. Normalização de strokes.
4. Template matcher.
5. Topology gate.
6. Painel debug.
7. SpellGraph.
8. Tinta mágica.
9. IA desenhando.
10. Grimório.
11. Infusões.
12. Preparação para online.

## Definition of Done

Uma entrega só conta se:

- npm run build passa;
- TypeScript passa;
- o app abre;
- rabiscos não passam como glifos válidos;
- falhas têm feedback claro;
- lógica nova é modular e testável.
