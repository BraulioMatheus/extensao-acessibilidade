# Validação técnica v0.6 — 18/11/2026

## Diagnóstico do CSV fornecido pelo usuário (v0.5)

- 2.011 linhas registradas (quadros apresentados).
- 2.078 quadros capturados, 67 descartados = **3,22%** dos capturados.
- Processamento por quadro: mediana **16,6 ms**, percentil 95 **27,85 ms**.
- `sourceTimeMs` mediano entre apresentações consecutivas: **66 ms** (~15 fps no trecho típico). Esse valor representa diferença dos timestamps dos quadros selecionados, não o FPS exato da tela.
- Atraso configurado 400 ms; mediana medida **416,3 ms**.
- `actualBufferMs` máximo **74.100,4 ms**, provavelmente devido a pausa/suspensão, sem confirmação causal no CSV.
- Há 52 diferenças entre timestamps acima de 80 ms e 21 acima de 150 ms (incluem pausas/possíveis buscas).
- O relatório não mede A/V, pois o áudio estava desativado.

### Intervenções da v0.6

1. Removido o limite artificial de captura de 38 ms que podia reduzir amostragem de vídeos de 30 fps para perto de 15 fps.
2. Filtro espacial 3x3 separável, em vez de 9 leituras de pixel por canal.
3. Resolução padrão da prévia reduzida de 320×180 para 256×144; medir efeito na legibilidade/qualidade.
4. Quadro muito antigo é descartado depois de suspensão longa, em vez de ser apresentado com atraso anormal.
5. Atraso de apresentação calculado desde a chegada do quadro ao callback, e não somente depois do processamento.
6. AudioContext opcional com MediaElementAudioSourceNode, DelayNode e GainNode.
7. O áudio usa o mesmo atraso nominal do vídeo; o gráfico de áudio é reconstruído em buscas/reinícios para evitar reproduzir áudio antigo.

## Testes executados no ambiente

- `node --check` de todos os JS: sem erros.
- Manifest JSON interpretado com sucesso.
- Chromium com scripts matemáticos carregados por injeção: **19/19** aprovados.
- Chromium com MP4 local carregado por `data:`: AudioContext `running`, `delayTime = 0.4 s`, reprodução avançando e desativação voltando a `muted = true`.
- Chromium com laboratório de teste carregado e `chrome.storage` simulado: sessão buffer criada, Canvas 256×144, report `actualBufferMs` ~408 ms em execução observada, 55 quadros apresentados após alguns segundos, botão de áudio com status ativo, reinício e exportação do CSV testados. Nenhum erro de JavaScript nesse teste.
- A navegação HTTP para `localhost` por browser automatizado é bloqueada por política deste ambiente; o teste integrado foi reproduzido por carregamento do HTML/scripts locais no navegador com armazenamento simulado. Não equivale a instalar a extensão completa no Chrome.

## Próximas medições necessárias

- Repetir o mesmo vídeo na v0.6 para comparar distribuição de `displayIntervalMs`, percentuais de descarte e processamento em relação à v0.5.
- Medir sincronismo A/V real (clique sonoro e mudança visual coincidentes no mesmo instante do arquivo, filmados/gravad​os por dispositivo externo ou método de medição equivalente); usar mediana, percentis, variabilidade.
- Testar pausa, reinício, busca, mudança de buffer e alternância de perfis com vídeos próprios.
- Incluir classificações de referência e medidas por região antes/depois para avaliação científica de eficácia.
