# Acessibilidade Visual Adaptativa — v0.7 (qualidade e movimento)

## O que muda

A v0.6 analisava **e exibia** o vídeo a 256×144. A v0.7 **mantém a análise** em até 256×144, mas captura quadros para exibição em resolução superior com `OffscreenCanvas.transferToImageBitmap()` (quando disponível) e armazena `ImageBitmap` na fila. O processamento da prévia usa composição Canvas 2D para suavização temporal, sem executar um filtro pixel a pixel em resolução superior. A detecção espacial permanece preliminar; o desfoque adicional é limitado, mas ainda pode reduzir a nitidez em cenas detectadas. Um indicador experimental de movimento reduz rastros da **suavização adaptativa** em mudanças espaciais; flashes uniformes não são tratados como movimento.

## Qualidade selecionável por perfil

- **Desempenho**: até 426×240.
- **Equilibrado**: até 854×480 (padrão).
- **Qualidade**: até 1280×720 (recomendado para seu teste).
- **Original**: até 1920×1080 (experimental; maior uso de memória/CPU/GPU).

A resolução nunca é aumentada acima da resolução nativa do vídeo; os limites acima são máximos de largura e altura. Ao trocar a qualidade a fila é reiniciada e o som mantém o atraso configurado. As preferências ficam nos três perfis existentes (`avaStateV3`).

## Instalação no Windows

1. Faça cópia da pasta `extensao-acessibilidade` da v0.6.
2. Extraia o ZIP. Copie os arquivos para a pasta do projeto, substituindo os antigos, sem criar uma subpasta entre `manifest.json` e `tests`.
3. Abra `chrome://extensions` e **Recarregar**. Depois atualize a página do laboratório.
4. No CMD, dentro da pasta que contém `manifest.json`, execute:

   `py -m http.server 8000 --bind 127.0.0.1`

5. Acesse `http://localhost:8000/tests/teste-video-buffer.html` e ative a extensão **Neste site** e **Análise automática**.
6. Selecione **Qualidade (até 1280×720)**, deixe brilho/contraste 100%, suavização espacial **0%** no primeiro teste e mantenha atraso 400 ms.
7. Para uma comparação de nitidez controlada, clique em **Carregar exemplo HD (nitidez)** (sem áudio). Depois carregue **o mesmo vídeo MP4** usado na v0.6, ative áudio se desejar, execute 30 s e exporte o CSV.
8. Compare com **Sem suavização matemática** para isolar perdas de imagem causadas por filtros; em seguida teste **Adaptativo**.

## Campos do CSV

Agora são exibidos `analysisWidth`, `analysisHeight`, `frameWidth`, `frameHeight`, `qualityMode`, `motionScore`, `rawAlpha`, `alpha` e `estimatedProcessedDeltaLuminance`. **A estimativa não mede diretamente os pixels apresentados**; por integridade experimental, `processedDeltaLuminance` e `deltaReductionPct` permanecem vazios. A v0.7 ainda precisará de uma medição separada de saída antes de afirmar quantitativamente que os estímulos diminuíram.

## Ressalvas

- O áudio é atrasado pelo `DelayNode` com valor nominal do buffer; não existe sincronismo A/V perfeito garantido.
- `requestVideoFrameCallback()` é uma notificação de melhor esforço, não uma garantia de captura de todos os quadros. Vídeos de sites protegidos continuam fora do escopo.
- Não substitui pipeline WebCodecs, não filtra pixels de toda a internet, não garante prevenção de reações fotossensíveis ou conformidade integral WCAG.
- **Original** pode piorar a fluidez em computadores com hardware limitado; utilize **Equilibrado** nesse caso.
- Alterações de qualidade e buscas no vídeo limpam a fila e o histórico temporal. O primeiro quadro após reinício será exibido sem suavização temporal para evitar rastros de uma cena anterior.
- Não são criadas cópias persistentes do vídeo, salvo arquivos CSV que você optar por exportar.

Abra `tests/unit-tests.html` para conferir os testes matemáticos.
