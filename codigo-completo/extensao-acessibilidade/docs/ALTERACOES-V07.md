# Mudanças técnicas v0.7

1. Separação entre imagem de análise (máximo 256×144) e quadros de exibição (limites por qualidade).
2. Fila de `ImageBitmap`, liberados com `.close()` na apresentação, limpeza ou descarte.
3. Composição temporal via Canvas 2D: histórico anterior + quadro atual com alfa; modo sem filtro apresenta o quadro integral.
4. Indicador amostrado de mudança espacial e limite de persistência apenas em modo adaptativo, com ressalvas para flashes; não é um detector WCAG.
5. Limitador de desfoque espacial em pixels para reduzir perda global de nitidez.
6. Novos campos CSV indicam resolução efetiva e índice de movimento; métricas de redução estimadas explicitamente separadas de medições da imagem final.
7. Preservados áudio com DelayNode, modos mutuamente exclusivos e três perfis salvos.
