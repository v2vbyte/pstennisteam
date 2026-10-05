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

## Trocar a cor principal

Em `css/style.css`, altere `--accent` (saibro `#A8492A`). Opções testadas: azul `#1F4E8C` e verde `#2F6B4F`. Atualize também o `theme-color` no `<head>` do `index.html`.

## Para depois

- **Vídeo do topo:** o comentário no `index.html` mostra como trocar o desenho da quadra por um vídeo curto.
- **Depoimentos:** a seção foi retirada por enquanto. Quando houver vídeos ou falas de alunos, ela pode voltar.
- **Dicas do Instagram:** quando os posts estiverem no ar, troque os links dos quatro blocos pelos links dos posts.
