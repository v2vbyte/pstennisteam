# Site pstennisteam

Site estático em HTML, CSS e JavaScript puros. Não usa bibliotecas; a única dependência externa é o Google Fonts (Barlow Condensed e Figtree).

## Estrutura

- `index.html`: todo o conteúdo da página
- `css/style.css`: visual (cores e fontes ficam em variáveis no início do arquivo)
- `js/main.js`: interações (WhatsApp, menu mobile, cards que viram, teste e perguntas frequentes)
- `img/`: logo (versões preta e branca em PNG, mais o SVG recortado), foto do Paulo e, depois, os vídeos

## Antes de publicar

1. **WhatsApp e telefone:** no início de `js/main.js`, preencha `whatsapp` (só dígitos, com 55 e DDD) e `telefoneExibido`. Todos os botões de agendamento, o botão flutuante e o teste passam a usar esse número.
2. **Textos entre colchetes:** procure por `[` no `index.html` e substitua (preços, número de alunos, perfil do Instagram, e-mail, CNPJ etc.).
3. **Vídeos e demais imagens:** a logo e a foto do Paulo já estão no lugar. Os comentários no `index.html` indicam onde trocar os placeholders restantes (vídeo do topo, depoimentos e capas das dicas) por `<img>` ou `<video>`.
4. **Grade de horários:** em "Onde e quando", troque `dot--free` por `dot` (e "Livre" por "Lotado") conforme a agenda.
5. **Links do rodapé:** as páginas de política de cancelamento e aviso de privacidade ainda precisam ser criadas.

## Trocar a cor principal

Em `css/style.css`, altere `--accent` (saibro `#A8492A`). Opções testadas: azul `#1F4E8C` e verde `#2F6B4F`. Atualize também o `theme-color` no `<head>` do `index.html`.

## Hospedagem

Qualquer serviço de site estático funciona (GitHub Pages, Netlify, Vercel ou a hospedagem do próprio domínio). Basta enviar a pasta inteira.
