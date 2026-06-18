# Playtest como jogador - 2026-06-05

## Escopo

- Chrome, desktop, viewport aproximado de 1904x855.
- Fluxo de primeira partida, sem ler a implementacao antes de jogar.
- Consulta ao Guia e Codex, desenho de circulo, sigilo de Aqua e chave de emissao.
- Tentativas de falha por tempo e falha de reconhecimento.

## Resumo

A apresentacao visual e forte, mas a primeira partida nao ensina uma formula executavel antes de iniciar a punicao. O maior problema observado foi o inimigo agir mais de uma vez depois de uma unica falha, fazendo a partida saltar do turno 1 para o turno 4 e removendo 27 pontos de vida. Nao foi possivel concluir uma magia com sucesso durante o playtest.

## Problemas prioritarios

### P0 - O inimigo age varias vezes apos uma unica falha

**Observado**

- Uma falha do jogador levou diretamente de `Rodada 1, Turno 1` para `Rodada 1, Turno 4`.
- O log registrou duas vezes que o inimigo lancou o mesmo projetil.
- A vida caiu de `100/100` para `73/100` antes de uma nova oportunidade real de resposta.

**Reproducao**

1. Inicie uma batalha.
2. Deixe o tempo acabar ou desenhe uma formula que falhe.
3. Aguarde a resolucao inimiga.

**Provavel causa tecnica**

O efeito do turno inimigo depende de `enemy` e `player`, mas altera ambos durante a propria resolucao. Enquanto `gamePhase` ainda e `enemy_turn`, essas alteracoes podem agendar outra resolucao antes de `advanceToNextDrawingTurn` mudar a fase.

Referencia: `src/App.tsx`, efeito de turno inimigo nas linhas 666-796.

### P1 - Guia e Codex nao pausam o cronometro

**Observado**

- O cronometro caiu de 44s para 37s enquanto o Codex estava aberto.
- A consulta ao Guia consumiu quase todo o primeiro turno.
- O combate continuou por tras dos modais e o personagem recebeu dano enquanto o jogador estudava.

**Impacto**

O jogo exige consulta visual para memorizar glifos, mas pune exatamente essa consulta. Para uma primeira partida, isso transforma aprendizado em derrota.

**Sugestao**

Pausar o turno enquanto Guia/Codex estiverem abertos ou oferecer uma fase de preparacao sem tempo antes do primeiro duelo.

### P1 - Falta uma receita inicial completa

**Observado**

- A tela informa que o inimigo e fraco a Aqua, mas nao mostra o sigilo de Aqua na pagina de combate.
- O Codex inicia vazio.
- O Guia mostra pecas isoladas, mas nao demonstra uma formula completa, sua ordem e sua disposicao.
- Nao fica claro se "Projetil de Aqua" exige Aqua, Emitir, Projetil, circulos locais e quais canais.

**Sugestao**

Adicionar um tutorial guiado com uma unica receita:

1. Trace o circulo externo.
2. Copie Aqua no centro.
3. Desenhe o escopo da chave.
4. Copie Emitir.
5. Ligue os componentes.
6. Confirme a magia.

### P1 - A formula e enviada automaticamente apos 1,8s de pausa

**Observado**

Depois que um circulo e detectado e ha pelo menos dois tracos, uma pausa curta finaliza a formula. Isso aconteceu enquanto ainda havia componentes a adicionar.

**Impacto**

- O jogador nao pode parar para observar o desenho.
- Abrir o Guia durante a composicao pode enviar uma formula incompleta.
- Nao existe indicacao clara de contagem regressiva para envio.

**Provavel causa tecnica**

`scheduleIdleFinalization` chama `finalizeGlyph` apos 1800 ms.

Referencia: `src/components/GameCanvas.tsx`, linhas 132-147.

**Sugestao**

Adicionar botao `Conjurar`, com envio automatico apenas como opcao de acessibilidade ou modo rapido.

### P1 - Nao ha desfazer ou limpar

**Observado**

Nao existem controles visiveis para desfazer o ultimo traco, limpar a pagina ou cancelar uma formula.

**Impacto**

Um erro pequeno condena o turno inteiro, gasta tinta e obriga o jogador a esperar a falha.

### P1 - Tracos curtos podem gastar tinta e desaparecer

**Observado**

Tentativas curtas de desenhar a seta de Emitir reduziram a tinta, mas nao permaneceram na pagina. A seta so ficou visivel quando foi desenhada maior e dentro de um circulo local.

**Provavel causa tecnica**

A tinta e consumida durante o movimento, mas tracos com menos de cinco pontos sao descartados no fim.

Referencia: `src/components/GameCanvas.tsx`, consumo nas linhas 177-190 e descarte nas linhas 241-243.

**Sugestao**

Nao cobrar tinta de tracos descartados ou garantir amostragem minima para gestos curtos.

## Clareza e feedback

### P2 - Mensagem de falha usa linguagem interna

Mensagem observada:

> Aumente a diferenca entre este glifo e candidatos parecidos; a margem semantica ficou estreita demais.

Termos como "margem semantica", "backend", "MagicFormulaV2" e "ontologia" nao ajudam o jogador a corrigir o desenho.

**Sugestao**

Usar instrucao visual e concreta, por exemplo: `O sigilo central ficou ambiguo. Reforce a ponta superior e a onda interna de Aqua.`

Referencia: `src/lib/recognizer/failureResolver.ts`, linhas 289-293.

### P2 - Mensagem de tinta parece contradizer a barra

**Observado**

O log exibiu `Tinta insuficiente: requer 5, disponivel 4`, enquanto a barra do jogador mostrava quase `24/24`.

A mensagem provavelmente pertence ao inimigo, mas nao identifica o autor. Em um log compartilhado, parece um erro da tinta do jogador.

**Sugestao**

Prefixar mensagens com o ator: `Aprendiz de Cinzas ficou sem tinta: 4/5`.

### P2 - O desenho some antes de poder ser comparado com a falha

Quando a formula falha, a pagina e limpa e sobra apenas um toast pequeno. O jogador perde a referencia visual necessaria para entender o que fez errado.

**Sugestao**

Congelar o desenho com sobreposicoes de diagnostico e oferecer `Tentar novamente` ou `Editar`.

### P2 - Progresso inicial e pouco explicado

A tela inicial mostra `10/11` sigilos e `8/13` chaves, mas o Codex informa `0 formulas` e `0 dominadas`. Nao fica claro se os numeros representam loadout, conhecimento ou progresso.

## Pontos positivos

- Direcao visual coesa e atraente; o livro de batalha comunica bem o tema.
- Fraqueza e resistencia do inimigo sao legiveis.
- O feedback `Circulo detectado` e util quando aparece.
- O catalogo pre-batalha tem boas miniaturas dos glifos.
- Vida, tinta, turno e log ficam no mesmo campo visual.

## Verificacao tecnica complementar

- `npm test -- --run`: 39 testes passaram.
- `npm run build`: build concluido.
- Nenhum erro de console da aplicacao foi observado; os avisos encontrados pertenciam a uma extensao do navegador.
- O build alerta para bundle principal acima de 500 kB.

## Ordem recomendada

1. Corrigir a repeticao do turno inimigo.
2. Pausar Guia/Codex e criar tutorial de primeira formula.
3. Substituir envio automatico por confirmacao explicita.
4. Adicionar desfazer/limpar e preservar o desenho em falhas.
5. Reescrever mensagens tecnicas como instrucoes visuais.
6. Corrigir atribuicao das mensagens de tinta.
