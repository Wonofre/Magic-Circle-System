# Design System — Círculo Mágico (Witch Hat Atelier)

## Product Context
- **What this is:** Jogo de batalha mágica por desenho de mandalas, inspirado no universo de Witch Hat Atelier.
- **Who it's for:** Fãs de fantasia, jogadores que gostam de desenhar fórmulas mágicas.
- **Reference:** Anime Witch Hat Atelier (MAPPA) — ateliê de velas, pergaminho envelhecido, tinta cobalto, ouro latão, profundidade cinematográfica.

## Aesthetic Direction
- **Direction:** Editorial/Magazine + Organic/Natural (grimório ilustrado)
- **Decoration level:** Expressive — texturas de papel, molduras ornamentais, luz de vela
- **Mood:** Intimista, misterioso, acolhedor — como folhear um grimório à luz de velas num ateliê de bruxas

## Typography
- **Display/Hero:** Cinzel — serifas clássicas evocam manuscritos medievais
- **Body:** Cormorant Garamond — elegante, legível, tom editorial
- **Data/Labels:** JetBrains Mono — números de tinta, timer, score
- **Scale:** xs(10px) sm(12px) base(14px) lg(18px) xl(24px) 2xl(32px) 3xl(40px)

## Color
- **Primary ink:** `#1a4a6b` — tinta mágica cobalto (traços no canvas)
- **Primary gold:** `#c9a227` — latão ornamentos e destaques
- **Gold bright:** `#e8c86a` — brilho de vela
- **Paper:** `#e8d4a8` / `#c9a86c` / `#a67c3d` — páginas de grimório
- **Paper ink:** `#2a1810` — texto em pergaminho
- **Table/BG:** `#0d0608` — fundo do ateliê
- **Wine:** `#2a1018` — painéis escuros adversários
- **Semantic:** success `#3d8b5a`, warning `#c9a227`, error `#8b2e3a`, info `#2d6a8f`

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48)

## Layout
- **Approach:** Hybrid — grid na batalha, editorial no menu
- **Border radius:** sm(4px) md(8px) lg(12px) — evitar border-radius uniforme em tudo

## Motion
- **Approach:** Intentional — flicker de vela, glow de magia, entrada suave de painéis
- **Easing:** enter ease-out, exit ease-in
- **Duration:** micro(100ms) short(220ms) medium(360ms) long(700ms)

## Assets
- `/assets/workshop-background.jpg` — fundo do ateliê
- `/assets/parchment-texture.jpg` — textura de página
- `/assets/magic-circle-frame.jpg` — moldura decorativa
- `/assets/witch-hat-emblem.jpg` — emblema do jogo

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-18 | Redesign Witch Hat Atelier MAPPA | Referência visual do anime para identidade coesa |