# Círculo Mágico

Jogo de magia por desenho inspirado em *Witch Hat Atelier*: trace mandalas no pergaminho, reconheça sigilos e chaves, e lance feitiços em duelos por turnos.

![Emblema do grimório](public/assets/witch-hat-emblem.jpg)

**Demo:** [wonofre.github.io/Magic-Circle-System](https://wonofre.github.io/Magic-Circle-System/)

## Como jogar

1. Clique em **Iniciar Batalha**.
2. No primeiro duelo, o **Grimório Vivo** abre com o tutorial de *Projétil de Aqua*.
3. Use **Começar a desenhar**, trace a mandala no canvas e feche o **círculo externo** para conjurar.
4. Derrote o inimigo desenhando fórmulas válidas antes que o tempo acabe.

O combate pausa enquanto o Grimório estiver aberto. Na primeira rodada, o inimigo só reage depois da sua primeira conjuração bem-sucedida.

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 80+ testes Vitest
npm run build    # dist/ para preview local
npm run preview
```

### Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento Vite |
| `npm test` | Suite de testes (reconhecimento, combate, regressões) |
| `npm run build` | Build de produção |
| `npm run build:pages` | Build com `base` para GitHub Pages |
| `npm run ml:smoke:web` | Smoke do lazy-load ML no browser |
| `npm run ml:train` | Pipeline de treino do classificador (Python/uv) |

## Arquitetura

O cliente é **React + TypeScript + Vite**. O fluxo de conjuração passa por três camadas:

1. **Canvas V2** — captura traços, fecha círculos e envia a mandala ao compilador.
2. **Reconhecimento V2** — matcher determinístico de templates fundido com classificador **ONNX** (carregado sob demanda na primeira conjuração).
3. **Spell V2** — compila `MagicFormulaV2` em `SpellCard`, resolve tinta, precisão, status e efeitos de campo.

O runtime ML (`onnxruntime-web` + WASM em `public/ort/`) fica em chunks separados do bundle principal para não bloquear o first paint do menu.

## Deploy (GitHub Pages)

O workflow `.github/workflows/ci.yml` roda testes e publica `dist/` em cada push em `main`.

**Configuração única no repositório:** Settings → Pages → Build and deployment → Source: **GitHub Actions**.

Build manual com o mesmo `base` do CI:

```bash
npm run build:pages
```

## Documentação

- Playtest e backlog: [`docs/playtest_feedback_2026-06-05.md`](docs/playtest_feedback_2026-06-05.md)
- Model card ONNX: [`public/models/glyph-recognizer-v1/MODEL_CARD.md`](public/models/glyph-recognizer-v1/MODEL_CARD.md)