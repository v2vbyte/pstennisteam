# Site PS Tennis Team

Site estático em HTML, CSS e JavaScript puros, sem bibliotecas. A única dependência externa é o Google Fonts (Barlow Condensed e Figtree).

## Estrutura

- `index.html`: todo o conteúdo da página, incluindo o aviso de privacidade
- `css/style.css`: visual (cores e fontes ficam em variáveis no início do arquivo)
- `js/main.js`: interações (WhatsApp, menu mobile, cards que viram, teste, perguntas frequentes e aviso de privacidade)
- `img/`: logo, foto do Paulo, ícones da aba (favicon) e imagem de compartilhamento

## Antes de publicar

1. **WhatsApp e telefone:** no início de `js/main.js`, preencha `whatsapp` (só dígitos, com 55 e DDD) e `telefoneExibido`. Todos os botões de agendamento, o botão flutuante e o teste usam esse número. Enquanto `telefoneExibido` estiver vazio, a linha "ou ligue" fica oculta.
2. **Preços:** só o Individual na Fama Tennis tem valor (R$ 990). Os demais aparecem como "Sob consulta". Para trocar, edite `plan__price` de cada card no `index.html`.

## GitHub Pages

- Envie o conteúdo desta pasta para a raiz do repositório.
- **Não apague o arquivo `CNAME`** que já existe no repositório: é ele que liga o site ao domínio pstennisteam.com.
- A imagem de compartilhamento usa o endereço completo `https://pstennisteam.com/img/compartilhamento.jpg`. Se o domínio mudar, atualize as linhas `og:url`, `og:image` e `canonical` no `<head>`.

## Grade de horários

Em "Onde e quando", cada célula da tabela tem `dot dot--free` (livre) ou só `dot` (lotado), seguida do texto escondido "Livre" ou "Lotado" para leitores de tela. Ao mudar uma célula, troque os dois.

## Animação da quadra

O rally do topo fica em `js/main.js`, na seção 10. Os pontos de batida estão em `HITS`, e a velocidade em `SHOT_MS` (milissegundos por batida). A animação só roda com o topo visível e não roda para quem ativou "reduzir movimento" no sistema.

## Animações ao rolar a página

Ficam em `js/main.js`, seção 12, e no fim de `css/style.css`. Para incluir ou tirar blocos, edite a lista `ANIMAR` (seletor e tipo: sobe, `esq`, `dir` ou `zoom`); `ESCALONAR` controla o intervalo entre itens do mesmo grupo. Os números das credenciais contam do zero. Nada anima para quem ativou "reduzir movimento".

## Google Ads (tag e consentimento)

- A tag do Google fica em `js/tag-google.js` e é carregada logo após o `<head>` em **todas as páginas** (`index.html`, `politica-cancelamento-reposicao.html` e `aula-experimental/index.html`). Toda página nova precisa da mesma linha.
- No início do arquivo: `TAG_ID` (contêiner `GTM-T9N2Z22P`) e `CONVERSAO` (o `send_to` da conversão do clique no WhatsApp). Enquanto `CONVERSAO` tiver `XXX`, a conversão não é enviada.
- A conversão dispara em qualquer link de WhatsApp de qualquer página.
- Consentimento (LGPD): a tag começa sem cookies de anúncio e só passa a usá-los depois do "Aceitar" na faixa. A escolha vale para o site inteiro e pode ser mudada em "Preferências de cookies", no rodapé.

## Página da aula experimental

Fica em `aula-experimental/`, com estilo e scripts no próprio `index.html`. É o destino dos anúncios.

## Trocar a cor principal

Em `css/style.css`, altere `--accent` (saibro `#A8492A`). Opções testadas: azul `#1F4E8C` e verde `#2F6B4F`. Atualize também o `theme-color` no `<head>` do `index.html`.

## Para depois

- **Vídeo do topo:** o comentário no `index.html` mostra como trocar o desenho da quadra por um vídeo curto.
- **Depoimentos:** a seção foi retirada por enquanto. Quando houver vídeos ou falas de alunos, ela pode voltar.
- **Dicas do Instagram:** quando os posts estiverem no ar, troque os links dos quatro blocos pelos links dos posts.

## Área do professor

Fica em `professor/` e é acessada só pelo link direto `pstennisteam.com/professor/`. Não há link para ela no site, ela não aparece no Google (`noindex`) e não carrega a tag do Google Ads, porque circulam dados de alunos.

- Tudo (estilo, scripts e o modelo do PDF) fica no próprio `professor/index.html`. O QR code do WhatsApp do PDF está em `professor/img/`.
- **Modo demonstração:** enquanto `API_URL` estiver vazio no bloco `CONFIG` (início do script), a página funciona só no aparelho, com texto de exemplo e login simulado.
- **Versão real:** preencha em `CONFIG` a `API_URL` (endereço do Google Apps Script publicado na conta pstennisteam@gmail.com) e o `GOOGLE_CLIENT_ID` (ID de cliente OAuth do Google Cloud). As contas autorizadas a entrar ficam no Apps Script, não na página.
- **Notas e classes:** os itens avaliados, os pesos, o guia da nota e a tabela de equivalência média → classe ficam no início do script (`ITENS`, `GUIA`, `FAIXAS` e `CRITERIOS`). A calibragem usa as descrições de nível do ITN (ITF): ITN estimado = 10 − (média − 1) × 7/9. A classe sugerida só vale depois que o professor confirma.
- **Imagem para redes:** gerada no próprio navegador, em 1080 × 1920 (story) ou 1080 × 1350 (feed), com foto opcional em preto e branco.
- Relatórios de exemplo: `professor/#exemplo-pdf` (aula experimental) e `professor/#exemplo-reavaliacao`.
