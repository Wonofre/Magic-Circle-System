# Rework visual TCG para o Magic Circle System

## Diagnóstico do projeto hoje

O repositório já tem uma base técnica boa para sustentar um rework visual pesado sem reescrever o jogo do zero: a stack é React 19 + TypeScript + Vite + Tailwind, com um pacote grande de componentes Radix já disponível, além de `embla-carousel-react`, o que facilita criar superfícies de coleção, carrosséis de cartas e navegação mais editorial. Ao mesmo tempo, não há hoje uma biblioteca dedicada de animação de interface como Motion nem uma camada gráfica especializada como PixiJS, então o front atual ainda está mais próximo de uma UI funcional do que de um battlefield de TCG premium. citeturn31view0

A tela principal de batalha confirma isso. O `App.tsx` concentra, na mesma superfície, barra de rodada/turno, combo, timer, HP e tinta de jogador e inimigo, canvas, componentes detectados, indicador de fase, log e feedback de magia. O preview do inimigo existe, mas entra apenas no `enemy_turn`, e o fluxo visual ainda parece mais “protótipo rico” do que “duelo com palco próprio”. citeturn10view0turn8view1

O canvas atual também ainda não materializa a fantasia que você descreveu. Em `GameCanvas.tsx`, ele é um círculo mágico sobre uma superfície escura com glow radial, anéis-guia e partículas simbólicas; isso funciona como linguagem de protótipo arcano, mas não como “livro vivo com papel, textura e página”. Além disso, o `SpellEffectDisplay` foi explicitamente desenhado como um toast compacto no canto superior direito para não bloquear o canvas, o que prioriza utilidade sobre espetáculo. citeturn8view0turn7view3

Há ainda uma fragmentação de informação e nomenclatura que enfraquece a fantasia de produto. O repo contém `GuidePanel.tsx`, `GrimoirePanel.tsx` e `CodexPanel.tsx`; o `App.tsx` importa `GuidePanel` e `CodexPanel`, enquanto `GrimoirePanel.tsx` também existe como superfície paralela. O `GuidePanel` atual já usa tabs como “Como Jogar”, “Sigilos”, “Chaves” e “Dicas”, e a screenshot de `grimoire-catalog-check.png` mostra uma estética âmbar/vinho bem promissora, mas essas superfícies ainda não convergiram numa arquitetura única de “Grimório/Codex/Collection”. citeturn46view0turn7view2turn9view0turn16view0

O ritmo atual do combate é, objetivamente, lento demais para parecer “certo”. O `App.tsx` define `PLAYER_CAST_RESULT_DELAY_MS = 4200`, `PLAYER_CAST_PHASE_ADVANCE_DELAY_MS = 1200`, `ENEMY_CAST_START_DELAY_MS = 1000` e `ENEMY_RESULT_DELAY_MS = 3200`; o `SpellEffectDisplay` fica visível por cerca de 3,5 s e só conclui em 4 s; e o `GameCanvas` ainda adiciona atrasos de finalização e leitura do glifo. Somando esses degraus, a sensação entre fechar o círculo e realmente voltar à ação pode passar de seis segundos em um cast normal, o que mata o senso de resposta e de impacto. citeturn9view0turn7view3turn8view0

Esse diagnóstico também bate com o próprio `brain.md`: as fases de reconhecimento, IA, Codex e telemetria avançaram bastante, mas a Fase 15 de assistência/UX ainda está aberta, e o próprio brain registra pendências importantes, como ausência de replay vetorial completo no Codex, preview do inimigo sem animação stroke-by-stroke e combate visual ainda preso ao motor legado. Além disso, o brain registra que o `README.md` continua genérico, e `src/pages/Home.tsx` ainda contém lixo do template Vite, o que é outro sintoma de front ainda não consolidado como produto. citeturn13view0turn12view0turn7view0

## O que a pesquisa de UI e game design indica

A direção correta não é “encher de ornamento”; é dar **caráter** sem sacrificar legibilidade. Uma análise de interfaces de jogos mostra exatamente esse ponto: UI boa em jogo estilizado funciona quando mantém estrutura simples, espaço para texto, ícones legíveis e hierarquia forte, mesmo em mundos cheios de textura, efeitos e movimento. Em outras palavras, o front precisa ter alma, mas a leitura do estado de jogo continua sendo a prioridade. citeturn41view2turn41view3

Isso é especialmente relevante para TCG. A carga cognitiva em jogos de carta é alta porque o jogador precisa manter muitos estados, relações e intenções na cabeça ao mesmo tempo. Pesquisa de UX em games observa que a memória de trabalho é limitada, que UI mal distribuída reduz sua eficácia e que um bom design deve “tirar trabalho” da cabeça do jogador, em vez de pedir que ele memorize tudo. Ela também destaca que a atenção útil não cobre a tela inteira com a mesma eficiência, então informações importantes muito espalhadas nas bordas competem mal entre si. citeturn41view4

O front de combate, portanto, precisa puxar o que importa para o centro perceptivo do jogador: intenção do oponente, estado dos recursos, magia em resolução e alvo do impacto. Hoje o projeto distribui muita coisa em áreas diferentes da tela; no rework, o board precisa ser redesenhado como um palco central com poucos focos concorrendo ao mesmo tempo. Isso é exatamente a lógica de UI que aparece em análises de cognitivo + UX em jogos complexos. citeturn41view4

A outra metade da equação é feedback. A equipe de VFX do Hearthstone descreveu o papel principal dos efeitos visuais com uma frase que vale como regra de projeto: VFX serve para comunicar informação ao jogador de forma divertida e interessante, ajudando a ler o board e a entender o que está acontecendo, enquanto reforça a personalidade do jogo. Isso importa muito para o seu pedido, porque a magia bonita não pode ser apenas cosmética; ela precisa esclarecer potência, alvo, elemento, sucesso, falha, bloqueio, cura e resistência. citeturn29view0

No tempo de animação, a pesquisa é ainda mais objetiva. A NN/g recomenda que a maior parte das animações fique em torno de 100–500 ms, dependendo da complexidade e da distância percorrida; simples feedback deve ficar por volta de 100 ms; mudanças grandes de tela costumam funcionar em 200–300 ms; e, acima de 500 ms, animações frequentemente passam a parecer atraso em vez de refinamento. Em paralelo, Jakob Nielsen lembra os limites clássicos de percepção: ~0,1 s para parecer instantâneo e ~1 s para manter o fluxo de pensamento sem interrupção. Para o seu jogo, isso significa que quase todo microfeedback e boa parte da resolução normal de um cast têm de caber em janelas muito menores do que as atuais. citeturn40view1turn40view0

Também existe uma implicação acessível importante: motion excessiva, especialmente rotação, scaling e pseudo-3D, pode ser desconfortável para usuários com sensibilidade a movimento. A web já oferece a media query `prefers-reduced-motion`, e a Apple destaca que Reduzir Movimento existe justamente para mitigar náusea, tontura, dores de cabeça e distração em interfaces que exploram profundidade e animação. Se você fizer página virando, câmera empurrando e magia ocupando a tela, precisa haver modo reduzido desde o primeiro dia. citeturn29view12turn29view13

Por fim, os benchmarks de TCG mostram que o *campo* e o *objeto colecionável* importam tanto quanto a lógica. Hearthstone transformou card backs e cartas douradas em superfícies de status e fantasia; Runeterra trata boards como produtos com elementos interativos, efeitos visuais e música; e o próprio Hearthstone ainda hoje atualiza UI de modos como Arena para sinalizar melhor as escolhas importantes da partida, como classes, banners e poderes em destaque. O lesson here é simples: para parecer TCG de verdade, seu jogo precisa fazer o grimório, o board, a carta resultante e o cast parecerem bens de alto valor simbólico, não apenas frames funcionais. citeturn43view2turn43view1turn20search2turn44view0

## Direção visual recomendada para virar um TCG de verdade

A minha recomendação é que você não tente “colar uma skin de TCG” por cima da UI atual. O melhor caminho é assumir uma fantasia central única: **um grimório vivo aberto sobre uma mesa de conjuração**, em que cada turno é uma página, cada magia é uma carta emergindo do papel e cada resolução deixa marcas físicas no livro e no duelo. Essa direção conversa com o que o projeto já tem de âmbar/vinho/oculto, conversa com a ideia de tinta mágica do `brain.md` e conversa com referências de fantasia manuscrita como *Inkulinati*, que explora combate com estética de manuscrito e tinta. citeturn16view0turn14view0turn12view0turn25search0

O layout de combate deveria ser refeito como um **spread de duas páginas**. A página da direita é a página ativa do turno: nela fica o canvas de desenho ou a resolução da magia. A página da esquerda é a página de contexto: histórico curto de casts, última magia do oponente, estado condensado do duelo, miniaturas das magias/círculos recentes e dicas contextuais quando necessário. Em vez de “HUD solto + canvas”, o jogador percebe um único objeto físico e diegético. Isso reduz fragmentação e dá imediatamente a sensação de produto autoral. citeturn41view4turn29view0

O oponente precisa sair do papel não literalmente, mas cenicamente. Em vez de um preview pequeno que aparece só no turno inimigo, coloque o inimigo num **altar superior central**, acima da dobra do livro, com retrato, HP, tinta, escudo, fraqueza e uma “trilha de intenção” sempre presente. Quando ele conjurar, a câmera da página ou o foco da composição pende para cima, e a magia dele surge visivelmente sobre a página dele — não como um widget lateral, mas como algo que rivaliza com o seu próprio cast. Isso atende o ponto de UX que pede menos busca periférica e menos troca de contexto mental. citeturn8view1turn41view4

O Codex também precisa mudar de função visual. Hoje ele é um catálogo filtrável e útil, mas ainda muito textual. O rework certo é transformá-lo num **álbum de cartas-magias**: cada descoberta vira uma lâmina/página com selo elementar, moldura por tipo, placa de maestria, replay curto do glifo, resumo de efeito e marcas de uso. Hearthstone mostra o valor de bordas, backs e animações como parte essencial do colecionável; o seu diferencial é que cada carta nasceu de um desenho, então o replay do traço é a joia do item. citeturn7view1turn13view0turn43view1turn43view2

A boa notícia é que você não precisa destruir a direção atual para conseguir isso. A screenshot existente já aponta um caminho estético forte: fundo vinho escuro, tipografia quente, iconografia dourada, abas e painéis com sensação de tomo mágico. O rework deve **evoluir** essa linha para papel, margem, borda impressa, hot-stamp dourado, fibras, manchas de tinta e desgaste de livro, em vez de trocar tudo por uma estética genérica de card game. citeturn16view0turn14view0

Minha proposta concreta de telas é esta:

- **Tela de batalha**: livro aberto ocupando o centro; oponente acima; recursos próximos à dobra; fundo como mesa/tomo/atelier; log de batalha reduzido a uma “marginalia” discreta, não um bloco principal.  
- **Turno do jogador**: página direita limpa, com papel visível e textura real; o círculo mágico surge “impresso” ali, e o desenho parece tinta viva no papel.  
- **Turno do inimigo**: a página vira ou desliza para o lado oposto; o jogador vê o traço inimigo se formando, o nome da magia e a intenção antes do impacto.  
- **Codex**: deixa de ser modal lista e vira viewer editorial com páginas, tabs na lateral do tomo e lâminas/cartas.  
- **Guide/Tutorial**: deixa de competir com Codex/Grimoire; vira a seção pedagógica dentro do mesmo livro, com abas laterais consistentes. citeturn46view0turn7view2turn9view0turn41view2

## Como gerar magias bonitas sem animar uma por uma

Aqui está a parte mais importante do plano técnico: você **não** deve criar uma timeline artesanal por magia. O próprio Hearthstone mostra por quê: mesmo para cartas douradas, o trabalho envolve separar camadas da arte, animar partes independentemente e iterar carta por carta; em um expansão, o volume de produção cresce muito rápido. Para o seu projeto, com magia procedimental e descoberta por desenho, esse modelo explode o custo imediatamente. citeturn43view0

O caminho certo é um **sistema de VFX procedural com assinatura determinística**. O repo já tem uma vantagem rara aqui: o `codexStore.ts` gera e persiste um `spellHash` determinístico para a estrutura da magia, e o `PerfectGlyphPreview` já renderiza prévias vetoriais canônicas dos símbolos. Ou seja, você já tem dois ingredientes perfeitos para VFX gerável: uma identidade estável por magia e uma representação gráfica vetorial do traço. citeturn11view0turn47view0

A arquitetura que eu recomendo é esta:

**Camada semântica**  
Recebe `spellHash`, `name`, `kind`, `target`, sigilos, signos e `effectSummary`. O `spellHash` define a assinatura estável; o nome ajuda a escolher o tom textual/cosmético; e sigilos/signos definem verbo visual, paleta e geometria principal. Uma mesma magia sempre parece “ela mesma”, mas com variação sutil, sem exigir authoring manual. citeturn11view0turn7view1

**Camada de receita visual**  
Transforma a magia em uma combinação de primitivas visuais. Exemplo:  
Fogo + emitir + alvo inimigo → runa acendendo, partículas ascendentes, projétil em arco curto, impacto abrasivo e cinzas;  
Água + restaurar + self → traço líquido regressivo, véu translúcido, brilho convergente e gotículas de retorno;  
Terra + conter + self → glifo talhado, pressão radial, estilhaço contido e escudo sedimentando;  
Sombra + selar → escrita invertida, anel fechando para dentro, ruído escuro, lacre e fade residual.  
Essas regras podem ser codificadas como receitas reutilizáveis, em vez de timelines únicas. A ideia é exatamente a mesma defendida por VFX orientado à leitura: o efeito precisa comunicar função, não só ser bonito. citeturn29view0

**Camada de primitivas**  
Use um vocabulário curto e reutilizável: line drawing do glifo, círculos concêntricos, ribbon/trail, shockwave, sparks, smoke/noise, distortion, decal de impacto e residue. Com poucas primitivas bem afinadas, você cobre dezenas de magias. Isso é viável porque Motion já suporta animação de SVG e desenho de path; a própria documentação mostra `pathLength` para “desenhar” linhas, e Motion para React oferece layout animation, entrada/saída e orquestração por variantes. citeturn39search9turn39search3turn34view8turn34view9

**Camada de render**  
Eu faria em dois estágios. Primeiro, **Motion + SVG + CSS** para colocar o look no ar rápido, aproveitando o que o projeto já tem de preview vetorial. Depois, quando o visual estiver aprovado, isolar uma **camada de VFX em PixiJS** apenas para conjuração, travel e impact. Isso reduz risco: você não troca a app inteira de abordagem gráfica, só encaixa um palco de efeitos por cima dela. PixiJS já oferece `ParticleContainer` para altíssimo volume de partículas, `Filter.from()` para filtros customizados via shader, `NoiseFilter`, `BlurFilter`, `DisplacementFilter`, `NineSliceSprite` para painéis ornamentados escaláveis e `TilingSprite` para texturas repetíveis de papel, borda e mesa. citeturn35view4turn35view3turn29view10turn29view11

Para vender a sensação de papel e tinta, você não precisa de assets gigantescos. O navegador já dá ferramentas valiosas: `mix-blend-mode` para misturar tinta e brilho com o fundo; `globalCompositeOperation` no canvas para composição e máscaras; `sepia()`, `saturate()` e `hue-rotate()` para modular a cor do papel e dos efeitos; e `clip-path`/`<clipPath>` para revelar magia rasgando, queimando ou abrindo janelas na página. citeturn38view0turn34view5turn38view2turn38view1turn34view3turn34view4

A virada de página também é tecnicamente factível sem um “middleware de livro” complexo no começo. CSS transforms suportam rotação 2D/3D, `perspective()` define profundidade, `backface-visibility` esconde o verso durante a rotação, e `clip-path` permite controlar as áreas visíveis. Para transições mais gerais entre estados do turno, a própria plataforma web já oferece View Transition API, que foi feita para animar mudanças entre views em SPA e MPA com customização e possibilidade de pular a transição quando necessário. citeturn34view0turn34view1turn34view2turn29view14turn29view15

Se a camada de efeito ficar pesada no notebook ou em mobile, a rota de desempenho também está clara. MDN observa que renderização e animação em canvas impactam o main thread, e `OffscreenCanvas` permite mover esse trabalho para worker, inclusive com `requestAnimationFrame()` no worker. Isso é ideal para deixar input, HUD e React soltos enquanto a magia roda em paralelo. citeturn37view0turn37view1turn34view6

O ponto central é este: **nome da magia não deve gerar uma animação literal única; ele deve selecionar e parametrizar uma receita visual determinística**. A identidade vem do `spellHash` e dos componentes mágicos; o nome ajuda no sabor, no título e em pequenos adornos. Assim você consegue “parece feita para essa magia” sem cair no buraco de produção infinita por conteúdo. citeturn11view0turn43view0turn35view4turn35view3turn39search9

## Ritmo do jogo e plano de implementação

O rework precisa atacar o **ritmo** tão agressivamente quanto o visual. Hoje o projeto empilha timeouts longos; isso transforma cada magia em uma fila de espera. A literatura de UX sugere que feedback simples deve parecer imediato, boa parte das mudanças de interface funciona em 100–500 ms, e o fluxo mental começa a ser quebrado depois de ~1 s. Para um TCG com fantasia e espetáculo, isso não significa abolir toda pausa; significa reservar pausa longa para “big moments”, e tornar o resto muito mais responsivo. citeturn9view0turn7view3turn8view0turn40view1turn40view0

Minha recomendação de cadência é esta, como alvo de direção e não como lei fixa:

- **Traço do jogador**: resposta imediata, com tinta aparecendo no mesmo frame da interação perceptível.  
- **Fechamento do círculo**: snap/pulse de 120–180 ms.  
- **Leitura do glifo**: 180–260 ms, com overlay curto “Interpretando fórmula”.  
- **Revelação do nome da magia**: 180–240 ms.  
- **Conjuração principal**: 250–350 ms em magias normais; 450–700 ms em magias de alto impacto.  
- **Travel/impacto**: 300–550 ms, dependendo do tipo.  
- **Pós-impacto**: 180–260 ms.  
- **Total de uma magia comum**: idealmente entre 1,4 s e 2,2 s do fechamento do círculo até o board estabilizado; finishers podem ir além, mas como exceção. citeturn40view1turn40view0

O truque para implementar isso sem quebrar a lógica atual é **separar orquestração visual de regras de combate**. O brain insiste corretamente em evolução modular, tipada e sem reescrever o projeto do zero. Então o melhor caminho é introduzir um `TurnPresentationDirector` e um `MagicVfxDirector`, deixando reconhecedor, spell engine e codex store praticamente intactos no começo. Você desloca o que hoje está disperso em `setTimeout` no `App.tsx` para uma timeline declarativa por estado visual, e preserva o domínio existente. citeturn12view0turn13view0

O plano de implementação que eu faria é este:

### Trilha de fundação visual

Primeiro, criar um sistema de **tokens visuais e de motion**: paleta de papel, vinhos, dourados, halftones, brilho por elemento, sombras, bordas, profundidades, timing e easing. Hoje o projeto já tem uma linguagem âmbar/oculta; o passo é formalizar isso para que batalha, codex, guide e overlays falem o mesmo idioma. citeturn14view0turn16view0

### Trilha do battlefield em livro

Depois, substituir o layout central do `App.tsx` por um shell novo, como `BattleSceneShell`, com spread de livro, altar do oponente, área de marginalia e page states. Aqui ainda não precisa mexer na conjuração procedural profunda; basta reposicionar tudo com uma arquitetura de cena correta e fazer o canvas viver “sobre papel”. Os recursos, por serem críticos, devem migrar para perto da dobra central e do oponente. citeturn10view0turn41view4

### Trilha de ritmo e motion

Em seguida, reduzir as esperas e migrar de timeouts fixos para uma timeline de apresentação com fases curtas, canceláveis e sincronizadas por evento. O `SpellEffectDisplay` deve deixar de ser toast dominante e virar parte da sequência de cast. Se algo passar de 2 s, a apresentação deve mostrar claramente que etapa está acontecendo, em vez de apenas “segurar” o jogador. citeturn7view3turn40view1turn24search12

### Trilha de VFX gerável

Só então encaixar o `MagicVfxDirector`, primeiro com SVG/Motion aproveitando a estrutura vetorial existente, depois com PixiJS numa camada especializada. Aqui entram partículas, filtros, distorção de papel, impacto e residuais de tinta. É a fase que dá o “uau”, mas ela precisa vir por cima de uma cena já organizada. citeturn47view0turn39search9turn35view4turn35view3

### Trilha de Codex e collection

Por fim, convergir `GuidePanel`, `GrimoirePanel` e `CodexPanel` em uma única superfície editorial. O jogador precisa sentir que aprendeu, descobriu e arquivou magia no mesmo objeto-narrativa: o grimório. Isso reforça progressão, identidade e o lado colecionável do TCG. citeturn46view0turn7view2turn7view1

Abaixo está um bloco pronto para você colar no `brain.md` como continuação do roadmap visual.

```md
### Fase 17 - Rework visual TCG e grimório vivo
- [ ] Criar `src/lib/ui/motionTokens.ts` com durações, curvas e níveis de intensidade por tipo de feedback.
- [ ] Criar `src/lib/ui/themeTokens.ts` com paleta de papel, ouro, vinho, tinta e acentos elementais.
- [ ] Criar `src/components/BattleSceneShell.tsx`.
- [ ] Transformar a tela de combate em um livro aberto com duas páginas.
- [ ] Mover HP, tinta, escudo, fraqueza e intenção para uma faixa central mais próxima da área de foco.
- [ ] Criar altar visual do oponente com retrato, recursos e trilha de intenção.
- [ ] Transformar log de batalha em marginalia contextual de baixo ruído.
- [ ] Substituir blocos utilitários por superfícies com textura, moldura e hierarquia editorial.
Criterio de aceite:
- combate lembra um duelo em grimório, não um protótipo com widgets;
- informações críticas ficam próximas ao foco principal;
- batalha continua legível em 1 olhar;
- `npm run build` passa.

Pendencias:
- validar legibilidade em monitores menores;
- criar fallback sem page flip para `prefers-reduced-motion`;
- revisar contraste antes da fase de polish.

### Fase 18 - Ritmo, telegraph e feedback cinematográfico
- [ ] Criar `src/lib/ui/turnPresentationDirector.ts`.
- [ ] Remover cadeia de timeouts longos do `App.tsx` e orquestrar a apresentação por fases visuais curtas.
- [ ] Reduzir o tempo total de resolução de cast comum para ~1.4s a 2.2s.
- [ ] Criar telegraph claro do turno inimigo com preview stroke-by-stroke.
- [ ] Integrar nome da magia, intenção, alvo e resultado no mesmo fluxo visual.
- [ ] Fazer o feedback de sucesso, resistência, escudo e cura acontecer dentro da sequência da magia, não como toast isolado.
Criterio de aceite:
- combate fica rápido o suficiente para manter flow;
- inimigo parece presente e inteligível;
- feedback é bonito, mas nunca atrapalha a leitura;
- finishers podem ser mais longos, casts comuns não.

Pendencias:
- calibrar timings com playtest;
- manter opção de pular/encurtar animações em debug;
- garantir sincronia entre dano aplicado e frame de impacto.

### Fase 19 - Magic VFX procedural por spellHash
- [ ] Criar `src/lib/ui/spellVfxSeed.ts`.
- [ ] Criar `src/lib/ui/spellVfxRecipes.ts`.
- [ ] Criar `src/components/MagicVfxLayer.tsx`.
- [ ] Usar `spellHash`, sigilos, signos, tipo e alvo para gerar assinatura visual determinística.
- [ ] Reaproveitar `PerfectGlyphPreview` e paths vetoriais para rune draw e conjuração inicial.
- [ ] Implementar biblioteca de primitivas: line draw, ring pulse, ribbon, sparks, shockwave, residue, impact decal.
- [ ] Adicionar camada opcional PixiJS apenas para efeitos mais pesados.
- [ ] Implementar fallback sem PixiJS em SVG/CSS/Motion.
Criterio de aceite:
- novas magias parecem autorais sem animação manual por magia;
- mesma magia sempre parece a mesma;
- VFX comunica função e elemento;
- performance continua aceitável.

Pendencias:
- avaliar OffscreenCanvas para efeitos pesados;
- limitar filtros caros em hardware fraco;
- revisar acessibilidade de flashes.

### Fase 20 - Unificação de Guide, Grimoire e Codex
- [ ] Criar `src/components/CodexBook.tsx`.
- [ ] Unificar `GuidePanel`, `GrimoirePanel` e `CodexPanel` numa IA única de grimório.
- [ ] Criar páginas de descoberta com replay do glifo, maestria, efeito e assinatura visual.
- [ ] Criar páginas de tutorial dentro do mesmo livro, não em superfícies concorrentes.
- [ ] Dar tratamento de carta/lamina para cada magia descoberta.
Criterio de aceite:
- o jogador entende que aprende, descobre e arquiva magia no mesmo objeto;
- a coleção parece um TCG;
- a progressão de maestria fica clara e desejável.

Pendencias:
- decidir se páginas usam paginação real ou rolagem interna por seção;
- testar densidade de informação de cada carta;
- conectar replay do glifo ao histórico real do jogador no futuro.
```

## Arquivos prontos para o Codex

Abaixo estão um `.skill` e um `.agent` pensados para o cenário real do repo: preservar a lógica já construída, atacar a frente visual com agressividade, unificar as superfícies de conhecimento e implementar VFX procedural baseado em `spellHash` e nos componentes da magia. Isso está alinhado com o estado atual do projeto, com o `brain.md` e com o fato de o repo já ter `PerfectGlyphPreview`, `CodexPanel`, IA de magia inimiga e hash determinístico. citeturn11view0turn13view0turn47view0turn8view1

### Arquivo sugerido para `.skill`

```yaml
name: tcg_visual_rework
version: 1
description: >
  Skill do Codex para transformar o Magic Circle System em um TCG visualmente convincente,
  com battlefield em grimório vivo, UI de combate cinematográfica, ritmo rápido e VFX procedural.

when_to_use:
  - Quando editar telas, HUD, overlays, codex, guide, grimoire, VFX, motion ou feedback de combate
  - Quando o objetivo for deixar o jogo mais parecido com um TCG premium
  - Quando uma tarefa pedir melhoria de legibilidade, ritmo, fantasia visual ou presença do oponente

project_truths:
  - O jogo nao pode virar um menu generico de skills
  - O jogador continua desenhando magias
  - O reconhecedor e o parser estrutural continuam sendo a autoridade
  - O rework visual nao deve reescrever o jogo do zero
  - Toda mudanca deve preservar npm run build
  - spellHash e identidades magicas deterministicas devem ser reaproveitados

primary_goals:
  - Fazer a batalha parecer um duelo em grimorio
  - Fazer o board parecer uma superficie premium de TCG
  - Dar presenca visual clara ao oponente e as magias dele
  - Fazer o feedback de magia ser bonito, legivel e rapido
  - Unificar Guide, Grimoire e Codex numa IA consistente
  - Criar VFX procedural sem authoring manual por magia

hard_rules:
  - Nunca adicionar animacao longa por vaidade
  - Feedback simples deve parecer imediato
  - Cast comum deve ser curto; apenas finishers podem respirar mais
  - Toda animacao precisa de fallback para reduced motion
  - Toda decisao de layout deve reduzir carga cognitiva, nao aumentá-la
  - Efeitos visuais devem comunicar elemento, alvo, tipo e impacto
  - Nao espalhar informacoes criticas pelos cantos da tela
  - Nao criar uma nova camada grafica pesada sem fallback simples
  - Reaproveitar assets, previews vetoriais e componentes existentes quando possivel

preferred_stack:
  - React + TypeScript + Tailwind
  - Motion para layout, entrada/saida, SVG e orquestracao
  - SVG para rune draw e glifos
  - PixiJS apenas para camada isolada de VFX, se necessario
  - CSS 3D transforms e clip-path para page turn inicial
  - OffscreenCanvas apenas quando houver problema real de performance

required_audit_before_coding:
  - Ler brain.md inteiro
  - Inspecionar App.tsx e o fluxo de turnos
  - Inspecionar GameCanvas.tsx
  - Inspecionar SpellEffect.tsx
  - Inspecionar CodexPanel.tsx, GuidePanel.tsx e qualquer painel paralelo de grimoire
  - Identificar timeouts longos e gargalos de feedback
  - Mapear o estado atual da tela antes de propor arquivo novo

design_doctrine:
  - O board e o grimorio sao o palco principal
  - O oponente deve ser visivel e interessante
  - O cast deve acontecer no mundo da pagina, nao num toast lateral
  - Cada magia deve deixar assinatura visual coerente
  - Textura de papel, borda, selo, tinta e pagina valem mais do que glass genérico
  - Personagem visual sem sacrificar legibilidade
  - Mostrar so o que importa no momento certo

vfx_grammar:
  inputs:
    - spellHash
    - spellName
    - sigils
    - signs
    - kind
    - target
    - effectSummary
  primitives:
    - rune_draw
    - ring_pulse
    - ember_or_droplet_particles
    - ribbon_trail
    - shockwave
    - distortion
    - impact_decal
    - residue
  composition_rules:
    - sigilo principal define paleta e energia base
    - verbo magico define o tipo de movimento
    - alvo define origem e destino
    - spellHash define seed de variacao
    - feedback final deve casar com dano, cura, escudo, resist ou falha

deliverables_for_any_task:
  - Auditoria curta do estado atual
  - Plano de alteracao em fatias pequenas
  - Implementacao modular
  - Lista de arquivos tocados
  - Resumo final claro
  - Pendencias adicionadas ao brain quando aplicavel

definition_of_done:
  - build passa
  - a tela ficou visualmente mais coesa
  - a leitura do combate melhorou
  - o ritmo ficou mais rapido e mais claro
  - reduced motion continua funcional
  - o resultado parece mais jogo e menos debug UI
```

### Arquivo sugerido para `.agent`

```yaml
name: codex_tcg_visual_director
version: 1
role: >
  Diretor de UI, front e game feel para o Magic Circle System.
  Atua como principal agente de rework visual sem quebrar o dominio existente.

mission: >
  Transformar o jogo em um TCG autoral de grimorio vivo, com combate legivel,
  ritmo correto, codex colecionavel, oponente presente e magias proceduralmente bonitas.

operating_principles:
  - Comecar sempre pelo repo real, nunca por fantasia de arquitetura
  - Propor alteracoes que caibam no estado atual do projeto
  - Atacar primeiro layout, hierarquia e ritmo; depois acabamento
  - Preservar dominio de magia, hash e reconhecimento
  - Reusar o que ja existe e isolar experimentos novos
  - Favorecer mudanças reversiveis e modulares
  - Toda tarefa precisa deixar resumo e pendencias

what_you_must_read_first:
  - brain.md
  - src/App.tsx
  - src/components/GameCanvas.tsx
  - src/components/SpellEffect.tsx
  - src/components/EnemyCastPreview.tsx
  - src/components/CodexPanel.tsx
  - src/components/GuidePanel.tsx
  - src/components/PerfectGlyphPreview.tsx
  - src/lib/spell/codexStore.ts

responsibilities:
  - Auditar UI atual e apontar gargalos de legibilidade
  - Redesenhar o combate como board de TCG em grimorio
  - Reduzir timeouts e melhorar game feel
  - Criar especificacao de motion por estado
  - Unificar surfaces de Guide/Grimoire/Codex
  - Definir pipeline de VFX procedural
  - Criar componentes novos com nomes claros e acoplamento baixo
  - Manter reduced motion e fallback visual

default_plan_for_each_task:
  - Etapa 1: auditar e listar contradicoes
  - Etapa 2: propor a menor fatia com maior ganho visual
  - Etapa 3: implementar sem reescrever o jogo inteiro
  - Etapa 4: validar build e revisar o fluxo final
  - Etapa 5: atualizar brain com resumo e pendencias

layout_rules:
  - Informacao critica perto do centro perceptivo
  - Oponente sempre presente
  - Menos widgets independentes, mais superficies diegeticas
  - Log e debug nunca competem com o cast principal
  - Cada tela deve ter foco primario unico

motion_rules:
  - Microfeedback: muito rapido
  - State change: curto
  - Big reveal: raro e intencional
  - Nunca segurar usuario sem informar o que esta acontecendo
  - Toda animacao deve poder ser reduzida ou pulada quando preciso

vfx_rules:
  - VFX e linguagem de jogo, nao ornamento gratuito
  - A magia deve ler bem mesmo em hardware medio
  - O mesmo spellHash precisa gerar assinatura visual consistente
  - Efeitos perigosos demais precisam de fallback reduzido
  - Evitar shader caro antes de provar necessidade

preferred_output_style:
  - Falar em pt-BR
  - Ser concreto e orientado a arquivos
  - Entregar tarefas fatiadas
  - Sempre incluir riscos, dependencias e pendencias
  - Sempre sugerir nomes de componentes e módulos

refusal_rules:
  - Nao reescrever o reconhecedor por causa de UI
  - Nao criar experiencias lentas so para parecer premium
  - Nao espalhar informacao importante em excesso
  - Nao trocar tudo por biblioteca nova se o ganho nao justificar
  - Nao deixar o brain desatualizado apos concluir tarefa

success_metrics:
  - Menos tempo morto entre acao e resposta
  - Mais legibilidade do board e da intencao do inimigo
  - Mais fantasia de TCG e grimorio
  - Mais clareza do que cada magia fez
  - Melhor sensacao de produto autoral

final_report_template:
  - O que foi encontrado
  - O que foi alterado
  - Por que melhora a experiencia
  - Arquivos modificados
  - Riscos restantes
  - Pendencias adicionadas ao brain
```

### Observação estratégica final sobre a implementação

Se eu tivesse que escolher uma única decisão para maximizar impacto com risco baixo, seria esta: **começar o rework pelo shell visual da batalha e pela sequência de cast, mantendo a lógica atual de magia intacta, e usar o `PerfectGlyphPreview` + `spellHash` como base para um primeiro VFX procedural em SVG/Motion**. Isso aproveita o que o repo já construiu, reduz retrabalho e entrega cedo exatamente o que hoje mais impede o jogo de “parecer certo”: palco, ritmo e presença visual. Só depois disso eu ligaria uma camada PixiJS dedicada a partículas/filtros para elevar o “wow” sem contaminar o resto da app. citeturn47view0turn11view0turn31view0turn35view4turn35view3