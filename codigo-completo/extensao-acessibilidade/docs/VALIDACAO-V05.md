# Validação do código da versão 0.5

Verificado em 18/11/2026:

- Todos os arquivos `.js` passaram na análise sintática `node --check` (Node 22).
- `manifest.json` passou na análise estrutural de JSON.
- 15 testes de funções matemáticas em `tests/unit-tests.js` passaram (executados em Node `vm`, com DOM mínimo simulado): os 11 originais mais 4 casos da fila de quadros.
- O vídeo `tests/fixtures/video-suave.mp4` foi gerado como MP4 de 6 segundos com variações suaves de brilho e sem som, para ensaios locais.

**Não validado neste ambiente:** execução visual completa em Chromium com extensão instalada e vídeo local. O navegador automatizado está impedido de navegar para `localhost` e `file://` por restrição administrativa. Faça esse ensaio no Chrome do Windows e registre os resultados para o TCC.

**Observação:** testes funcionais em Node não demonstram que o buffer exiba todos os quadros de um vídeo, nem que faça correção garantida ou conformance WCAG. Há limitações explícitas de amostragem, precisão do relógio, sincronismo de áudio e acesso a pixels.
