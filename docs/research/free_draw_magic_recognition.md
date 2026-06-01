# Research — Reconhecimento de magia desenhada livremente

Este documento resume a pesquisa e as decisões técnicas feitas na conversa para evoluir o projeto de um reconhecedor geométrico simples para um **compilador de magia desenhada**.

---

## 1. Problema central

O jogo não pode aceitar um rabisco como qualquer glifo válido. O sistema precisa reconhecer:

- forma visual;
- assinatura topológica;
- loops;
- strokes abertos/fechados;
- interseções;
- ordem/direção dos traços;
- portas de conexão;
- relações entre glifos;
- intenção mágica final.

A decisão final não deve ser “o mais parecido visualmente”. Deve ser:

```txt
forma parecida + topologia compatível + gramática válida + confiança suficiente
```

---

## 2. Pipeline recomendado

```txt
DrawingStroke[]
-> normalize to 0..100
-> simplify / resample
-> detect noise/scribble
-> template matching
-> topology validation
-> semantic margin check
-> graph compile
-> ink simulation
-> spell/cast result
```

---

## 3. Métodos úteis

### 3.1 Template matching vetorial

Usar templates com strokes normalizados em `0..100`, como `src/data/glyphTemplates.seed.json`.

Bom para:

- MVP;
- debug;
- pouca dependência de ML;
- reconhecimento reproduzível.

Limite:

- precisa de validação topológica junto;
- sozinho pode aceitar desenhos “parecidos, mas errados”.

### 3.2 $1 / $P / $Q recognizers

Família de algoritmos conhecida para reconhecimento de gestos por pontos/strokes.

Uso recomendado:

- preview;
- ranking inicial;
- candidatos top 5;
- protótipo rápido.

Não usar como autoridade única, porque métodos point-cloud podem ignorar ordem, direção ou semântica.

Fontes:

- $1 Recognizer: https://depts.washington.edu/acelab/proj/dollar/index.html
- $P Recognizer: https://depts.washington.edu/acelab/proj/dollar/pdollar.html
- $Q Recognizer: https://depts.washington.edu/acelab/proj/dollar/qdollar.html

### 3.3 Métricas geométricas clássicas

Úteis para complementar o reconhecimento:

- Hu Moments;
- matchShapes;
- Hausdorff distance;
- Shape Context;
- Dynamic Time Warping.

Fontes:

- OpenCV shape descriptors: https://docs.opencv.org/4.x/d3/dc0/group__imgproc__shape.html
- Hausdorff extractor: https://docs.opencv.org/4.x/d0/de1/classcv_1_1HausdorffDistanceExtractor.html
- Shape Context: https://en.wikipedia.org/wiki/Shape_context
- Dynamic Time Warping: https://en.wikipedia.org/wiki/Dynamic_time_warping

### 3.4 ML / Vision AI

Pode ser usado no futuro para:

- sugerir intenção;
- detectar rabisco;
- descrever desenho complexo;
- auxiliar classificação quando o parser está incerto.

Mas não deve decidir sozinho.

Autoridade final deve continuar sendo:

1. topologia;
2. gramática;
3. templates;
4. thresholds;
5. simulação.

Fontes úteis:

- Google ML Kit Digital Ink Recognition: https://developers.google.com/ml-kit/vision/digital-ink-recognition
- Sketch-a-Net: https://arxiv.org/abs/1501.07873
- Siamese networks for verification: https://arxiv.org/abs/1904.00240

---

## 4. Topology gate

O topology gate é obrigatório para evitar exploits.

Validar:

- loops esperados;
- strokes abertos esperados;
- interseções esperadas;
- fechamento mínimo;
- ruído desconectado;
- portas conectadas;
- geometria dominante;
- ambiguidade entre templates.

Exemplo:

```txt
Um desenho parecido com círculo, mas aberto, não é FRAME_CIRCLE_CONTAINMENT.
É RISK_LEAK ou falha.
```

---

## 5. Falhas mágicas

Falhas devem ser diegéticas:

| Falha técnica | Resultado mágico |
|---|---|
| baixa confiança | fizzle |
| loop obrigatório aberto | vazamento |
| topologia incompatível | falha estrutural |
| ambiguidade alta | miscast |
| excesso de tinta | backfire |
| alvo ausente | erro de alvo |
| conexão errada | efeito parcial |

---

## 6. Métricas de qualidade

Acompanhar:

- accuracy por glifo;
- false positive de rabiscos;
- false negative de desenhos válidos;
- precision/recall;
- margem top1/top2;
- score topológico;
- taxa de backfire por jogador;
- taxa de frustração em UX tests.

Fonte para métricas ML gerais:

- scikit-learn model evaluation: https://scikit-learn.org/stable/modules/model_evaluation.html

---

## 7. Decisão para o MVP

Não começar com ML pesado.

Começar com:

1. templates vetoriais;
2. normalização;
3. resampling;
4. template matching;
5. topology gate;
6. debug panel;
7. SpellGraph simples.

ML/Vision entra só depois, como camada auxiliar.
