# Arquitetura e decisões do experimento

A extensão executa os módulos no *isolated world* de `content_scripts` na ordem declarada no `manifest.json`. Eles registram funções sob `globalThis.AVA`. Não usa bibliotecas terceirizadas e não precisa de bundler nem de `package.json`.

Fluxo para imagens de site: `content.js` -> `imageReader.fromImage` (Canvas, se autorizado) -> `luminance.analyze` -> `contrast.analyze` -> `adaptive.decide` -> atenuação seletiva de CSS sobre a imagem, apenas se a opção de análise estiver ligada e um limiar heurístico for atingido.

Fluxo de vídeo de laboratório (não geral): vídeo oculto marcado `data-ava-process="video"` -> `VideoSampler` -> `luminance.analyze` -> `flash.push`/`contrast.analyze` -> `adaptive.decide` -> `TemporalFilter.apply` -> `gaussian3x3` (se necessário) -> `putImageData` em canvas próprio. Sem garantia de processamento antes da apresentação de quadros em outros contextos.

Os três perfis herdam os campos da versão 0.3 e acrescentam `automaticAnalysis`, `smoothingMode`, `sensitivity`, `temporalStrength` e `spatialStrength`. A chave persistente permanece `avaStateV3` para não perder as preferências existentes.

### Decisões científicas ainda abertas

1. Definir quantitativamente os limiares de classificação por categoria de estímulo com literatura e conjuntos de calibração.
2. Implementar, se necessário para avaliação normativa, o procedimento integral de **flashes gerais e vermelhos** da WCAG 2.2, incluindo as transições e a extensão angular da área; o algoritmo atual NÃO faz essa validação.
3. Selecionar páginas e mídias independentes para classificação de referência (*ground truth*) e medir precisão, revocação, F1, falsos positivos e falsos negativos por categoria.
4. Comparar sem filtro, filtro fixo e filtro adaptativo usando **mesmos exemplos e níveis comparáveis de atenuação**; não pressupor que adaptativo terá desempenho superior.
5. Medir preservação de legibilidade, incluindo contraste de textos (página) e mudanças em imagens; separar regiões de estímulo das não críticas.
6. Medir CPU/memória, fps, latência real e capacidade de processamento em diversas condições de hardware.
7. Documentar limitações de CORS, iframes, DOM, Canvas, vídeo, GIF e permissões do navegador.

**Observação:** o modo de suavização 'fixed' aplica alfa constante; no modo 'adaptive', alfa depende do indicador heurístico normalizado e pode permanecer 1 (sem intervenção) quando o estímulo é fraco.


## AVA 0.5 — Buffer experimental de quadros

O módulo `capture/frame-buffer.js` encapsula `FrameQueue` e `BufferedVideoSession`. Na página `tests/teste-video-buffer.html`, o vídeo-fonte é oculto, decodificado pelo navegador e amostrado por Canvas. Os quadros amostrados passam por detecção e filtragem antes de entrar em uma fila limitada (50 frames ou 24 MiB). O relógio de saída utiliza `performance.now()` para esperar entre 200 e 1.000 ms antes de renderizar no Canvas.

O vídeo original jamais é exibido pelo laboratório, mas `requestVideoFrameCallback()` pode ser invocado após o envio do quadro ao compositor; por isso **não se considera essa arquitetura proteção de estímulos ou um pipeline completo de decodificação antecipada**. O monitor de animação usa `requestAnimationFrame()` como fallback quando callbacks de vídeo não são emitidos para fontes fora da tela. O áudio é desativado até existir sincronização explícita.

Métricas adicionais: `bufferTargetMs`, `actualBufferMs`, `queuedFrames`, `droppedFrames`, `framesCaptured`, `framesDisplayed`, `originalDeltaLuminance`, `processedDeltaLuminance`, `deltaReductionPct`. Uma redução positiva da variação de luminância global **não** demonstra controle de flashes por regiões, nem conformidade WCAG.


## Evolução v0.6: sincronização audiovisual experimental

O laboratório controla um `<video>` HTML oculto e exibe apenas os quadros processados em Canvas, com atraso `bufferDelayMs`. O script `capture/audio-sync.js` roda na **página do laboratório**, não no script de conteúdo da extensão. Um clique explícito cria um `AudioContext` e um único `MediaElementAudioSourceNode`, roteando o áudio para `DelayNode` e `GainNode` até o dispositivo de saída. O atraso nominal é igual ao usado na fila visual e é atualizado quando o perfil muda. O áudio sai silenciado por padrão.

Na captura, a fila visual guarda o relógio de chegada ao callback (`performance.now`) e apresenta o quadro quando esse tempo atinge `capturedAt + delayMs`. Ajustes dos perfis não desmontam as sessões ativas do buffer, para evitar reinícios. Quadros antigos demais são descartados. A filtragem espacial separável reduz o custo; a resolução da prévia atual é 256×144.

A sincronização é **aproximada**, pois o áudio e o vídeo passam por caminhos de agendamento distintos, o vídeo é capturado após a decodificação e a latência do hardware de áudio varia. `schedulingLatenessMs` indica atraso de apresentação no Canvas, não mede A/V absoluto. Para pesquisa, é necessária aferição externa e testes com amostras adequadas.
