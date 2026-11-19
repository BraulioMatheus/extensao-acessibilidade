
# Acessibilidade Visual Adaptativa

Projeto experimental de extensão para Google Chrome
destinada à detecção e suavização adaptativa de
estímulos visuais potencialmente sensíveis na Web.

## Objetivo

Desenvolver e avaliar algoritmos de processamento
digital de imagens capazes de identificar
características visuais potencialmente sensíveis
e aplicar técnicas de suavização adaptativa.

## Funcionalidades

- Detecção experimental de variações de luminância.
- Análise de padrões espaciais de contraste.
- Controle de animações web.
- Suavização temporal e espacial.
- Processamento de vídeo por buffer.
- Perfis personalizáveis de usuário.
- Coleta de métricas experimentais em CSV.

## Tecnologias

- JavaScript
- HTML5
- CSS3
- Chrome Extensions Manifest V3
- Canvas API
- Web Audio API

## Instalação

1. Abra chrome://extensions no Google Chrome.
2. Ative o modo do desenvolvedor.
3. Clique em "Carregar sem compactação".
4. Selecione a pasta do projeto.

## Testes

As páginas de testes estão disponíveis na pasta
tests/.

Para iniciar o servidor local:

py -m http.server 8000 --bind 127.0.0.1

## Estado do projeto

Versão experimental 0.7.

Os algoritmos estão em desenvolvimento e
necessitam de calibração e validação científica.

Este software não garante prevenção de reações
fotossensíveis nem conformidade integral com
as diretrizes WCAG.

## Contexto acadêmico

Projeto desenvolvido no contexto de um Trabalho
de Conclusão de Curso em Engenharia de Computação.
