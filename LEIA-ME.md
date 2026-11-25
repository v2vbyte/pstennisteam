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

- O código da tag do Google (`GTM-T9N2Z22P`, conta `AW-18593472042`) fica **direto no `<head>`** de cada página pública (`index.html`, `politica-cancelamento-reposicao.html` e `aula-experimental/index.html`), no formato do Google Ads, para o Google detectar a tag. Antes dele vem o consentimento padrão (negado). Toda página pública nova precisa do mesmo bloco. A área do professor (`professor/`) fica de fora de propósito: é ferramenta interna.
- `js/tag-google.js`, carregado logo depois, envia a conversão "Contato" (clique no WhatsApp) e oferece `PSConsentimento` para as faixas de cookies.
- Para não contar robôs e toques acidentais, a conversão só conta com clique real, navegador não automatizado, pelo menos `TEMPO_MINIMO` segundos na página e uma vez por visita.
- Consentimento (LGPD): a tag começa sem cookies de anúncio e só os usa depois do "Aceitar". A escolha vale para o site inteiro e pode ser mudada em "Preferências de cookies", no rodapé.

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
- **Versão real (no ar desde 25/11/2026):** preenchidos em `CONFIG` a `API_URL` (endereço do Google Apps Script publicado na conta pstennisteam@gmail.com) e o `GOOGLE_CLIENT_ID` (ID de cliente OAuth do Google Cloud). As contas autorizadas a entrar ficam no Apps Script, não na página.
- **Notas e classes:** os itens avaliados, os pesos, o guia da nota e a tabela de equivalência média → classe ficam no início do script (`ITENS`, `GUIA`, `FAIXAS` e `CRITERIOS`). A calibragem usa as descrições de nível do ITN (ITF): ITN estimado = 10 − (média − 1) × 7/9. A classe sugerida só vale depois que o professor confirma.
- **Modo app:** a página tem manifesto (`professor/manifest.webmanifest`) e ícone próprio ("PS Professor"). Salva na tela inicial do celular, abre em tela cheia, sem as barras do navegador. O login do Google fica guardado no aparelho até expirar (cerca de 1 hora) e depois o Google tenta entrar sozinho na mesma conta.
- **PDF na pasta do aluno:** o PDF com a identidade visual é montado no navegador (`professor/vendor/`: html2canvas e jsPDF, licença MIT) e enviado ao Apps Script, que o salva na pasta do aluno e põe o link na planilha. Sempre que o diagnóstico muda (aula nova, classe confirmada ou edição no Google Doc), a versão antiga vai para a lixeira do Drive e a nova fica no lugar.
- **Post de parabéns:** quando o aluno sobe de classe, a página gera no navegador um post do Paulo para o aluno ("Parabéns! Você subiu para a Xª classe!"), só com o nome, em 1080 × 1920 (story) ou 1080 × 1350 (feed).
- **Motor (Apps Script):** o código fica em `apps-script/Code.gs` e roda na conta pstennisteam@gmail.com. Ele confere o login, chama o Claude (duas chamadas em paralelo: diagnóstico e plano), cria no Drive uma pasta por aluno com um Google Doc editável por aula, registra cada aula na planilha "PS Tennis · Registro de aulas" (uma linha por aula, com perfil do aluno, classes, média, ITN e uma coluna por nota de golpe, pronta para dashboards; o script acha as colunas pelo nome do cabeçalho) e avisa por e-mail. As notas internas não vão para o Claude. A classe parte da média das notas e o Claude pode ajustá-la em no máximo uma classe, com base nas observações; o professor sempre confirma. As edições feitas no Google Doc voltam para o PDF quando o professor toca em "Ver e salvar o PDF". Para testar mudanças no código sem gastar a API, há uma simulação local em `apps-script/teste/` (rodar `node apps-script/teste/test.js`).
- Relatórios de exemplo: `professor/#exemplo-pdf` (aula experimental) e `professor/#exemplo-reavaliacao`.
