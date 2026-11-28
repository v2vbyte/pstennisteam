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
- **O endereço principal é `https://www.pstennisteam.com`** (com www, como está no `CNAME`). Quem digita sem www é redirecionado. Por isso todos os endereços completos do site (`canonical`, `og:url`, `og:image`, dados estruturados, `sitemap.xml` e `robots.txt`) usam o www. Se o `CNAME` mudar, troque todos juntos.

## Grade de horários

Em "Onde e quando", cada célula da tabela tem `dot dot--free` (livre) ou só `dot` (lotado), seguida do texto escondido "Livre" ou "Lotado" para leitores de tela. Ao mudar uma célula, troque os dois.

## Animação da quadra

O rally do topo fica em `js/main.js`, na seção 10. Os pontos de batida estão em `HITS`, e a velocidade em `SHOT_MS` (milissegundos por batida). A animação só roda com o topo visível e não roda para quem ativou "reduzir movimento" no sistema.

## Animações ao rolar a página

Ficam em `js/main.js`, seção 12, e no fim de `css/style.css`. Para incluir ou tirar blocos, edite a lista `ANIMAR` (seletor e tipo: sobe, `esq`, `dir` ou `zoom`); `ESCALONAR` controla o intervalo entre itens do mesmo grupo. Os números das credenciais contam do zero. Nada anima para quem ativou "reduzir movimento".

## Tag do Google (Ads, Analytics e consentimento)

- O código da tag do Google (gtag.js, conta `AW-18593472042`) fica **direto no `<head>`** de cada página pública (`index.html`, `politica-cancelamento-reposicao.html` e `aula-experimental/index.html`), no formato do Google Ads, para o Google detectar a tag. Antes dele vem o consentimento padrão (negado). Toda página pública nova precisa do mesmo bloco. A área do professor (`professor/`) e a página 404 ficam de fora de propósito.
- `js/tag-google.js`, carregado logo depois, envia a conversão "Contato" do Google Ads (clique no WhatsApp), liga o Google Analytics 4 e oferece `PSConsentimento` para as faixas de cookies.
- Para não contar robôs e toques acidentais, a conversão do Ads só conta com clique real, navegador não automatizado, pelo menos `TEMPO_MINIMO` segundos na página e uma vez por visita.
- **Google Analytics 4:** fica desligado enquanto `GA4` estiver vazio no início de `js/tag-google.js`. Para ligar, cole ali o ID da propriedade (formato `G-XXXXXXXXXX`). Não precisa mexer nas páginas. O GA4 registra sozinho visitas, origem, rolagem e cliques em links externos, e o site envia dois eventos próprios:
  - `clique_whatsapp`: todo clique real em um botão de WhatsApp, com o parâmetro `origem` (id da seção, `botao-flutuante` ou `rodape`). Marque como **evento principal** no GA4.
  - `teste_concluido`: quando alguém termina o teste "Qual aula é para você?", com `para_quem`, `objetivo` e `formato` (só o tipo de resultado, nunca a mensagem). Vem de `js/main.js` por `PSMedir.evento`.
- Consentimento (LGPD): a tag começa sem cookies de anúncio nem de estatística e só os usa depois do "Aceitar". Uma escolha vale para os dois e para o site inteiro, e pode ser mudada em "Preferências de cookies", no rodapé. A escolha fica no navegador com a chave `ps-consentimento` (antes era `ps-consentimento-anuncios`; a troca fez a faixa aparecer de novo para todos, com o texto novo). Se mudar a chave, mude no `<head>` de cada página e em `js/tag-google.js`.
- O aviso de privacidade (em `index.html`) explica as duas medições em "Estatísticas de visitas" e "Anúncios do Google". Se um evento novo passar a enviar outro tipo de informação, atualize o texto.

## Busca no Google (SEO)

- `sitemap.xml`: lista das páginas públicas para os buscadores. Ao criar uma página (ou o blog), inclua um bloco `<url>` e atualize `<lastmod>`. A área do professor e `midia-anuncios/` ficam de fora.
- `robots.txt`: libera o site e aponta o sitemap. Bloqueia só `apps-script/`. A área do professor não aparece nele de propósito, para não divulgar o endereço: ela já tem `noindex`.
- **Dados estruturados (schema.org):** blocos `application/ld+json` no `<head>`. Na home, o site e o negócio (endereço da Fama Tennis, telefone, e-mail, Instagram, Paulo Santana e as modalidades, sem preços). Na aula experimental, o serviço, ligado ao negócio pelo `@id`. Só entra o que também aparece na página. Se telefone, endereço ou modalidades mudarem, atualize junto. Para conferir: [Teste de pesquisa aprimorada](https://search.google.com/test/rich-results) e [validator.schema.org](https://validator.schema.org).
- Toda página pública tem `<link rel="canonical">` com o endereço completo.
- `404.html`: página de erro na identidade da marca, que o GitHub Pages mostra em qualquer endereço inexistente. Por isso os caminhos dela começam com `/`. Tem `noindex` e não carrega a tag do Google.

## Avaliação e classes (site público)

- Na home, a seção `#avaliacao` (logo depois de "O professor e o método") mostra os 11 fundamentos avaliados, o que vem no relatório e a escada da 6ª à 1ª classe. Cada degrau usa `--h` (1 a 6) para a altura, e as faixas de ITN seguem a tabela `FAIXAS` da área do professor. Se a tabela mudar lá, atualize aqui também.
- Na página da aula experimental, a seção "O que você leva" traz uma capa de relatório ilustrativa, com dados fictícios (Mariana, 5ª classe, média 3,8, ITN 8) e a etiqueta "Exemplo".
- Todo aluno recebe o relatório completo, inclusive na aula experimental (paga).
- O texto sobre reavaliações (fim da 8ª semana e depois a cada ciclo de 8 semanas) segue o plano que o Apps Script monta (`apps-script/Code.gs`). Se os ciclos mudarem, atualize a home e as perguntas frequentes.
- O aviso de privacidade (em `index.html`) tem a parte "Avaliação dos alunos", com os dados registrados pelo professor, onde ficam e o uso do Claude para escrever o relatório. Se a ficha da área do professor passar a pedir outros dados, atualize esse texto.

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
- **PDF:** o botão "Abrir o PDF" gera o arquivo PDF de verdade (sem passar pela impressão), com opções de abrir, enviar pelo celular ou baixar. O PDF usa um layout próprio para celular (`relatorioMobile`): uma coluna estreita em que cada página tem a altura do próprio conteúdo, então nada transborda. O arquivo se chama "Avaliação - Nome" (reavaliações: "Reavaliação - Nome - data"). Ele é montado no navegador (`professor/vendor/`: html2canvas e jsPDF, licença MIT) e enviado ao Apps Script, que o salva na pasta do aluno e põe o link na planilha. Sempre que o diagnóstico muda (aula nova, classe confirmada ou edição no Google Doc), a versão antiga vai para a lixeira do Drive e a nova fica no lugar.
- **Post de parabéns:** quando o aluno sobe de classe, a página gera no navegador um post do Paulo para o aluno ("Parabéns! Você subiu para a Xª classe!"), só com o nome, em 1080 × 1920 (story) ou 1080 × 1350 (feed).
- **Motor (Apps Script):** o código fica em `apps-script/Code.gs` e roda na conta pstennisteam@gmail.com. Ele confere o login, chama o Claude (duas chamadas em paralelo: diagnóstico e plano), cria no Drive uma pasta por aluno com um Google Doc editável por aula, registra cada aula na planilha "PS Tennis · Registro de aulas" (uma linha por aula, com perfil do aluno, classes, média, ITN e uma coluna por nota de golpe, pronta para dashboards; o script acha as colunas pelo nome do cabeçalho) e avisa por e-mail. As notas internas não vão para o Claude. A classe parte da média das notas e o Claude pode ajustá-la em no máximo uma classe, com base nas observações; o professor sempre confirma. As edições feitas no Google Doc voltam para o PDF quando o professor toca em "Ver e salvar o PDF". Para testar mudanças no código sem gastar a API, há uma simulação local em `apps-script/teste/` (rodar `node apps-script/teste/test.js`).
- Relatórios de exemplo: `professor/#exemplo-pdf` (aula experimental) e `professor/#exemplo-reavaliacao`.
- **Navegação:** menu inicial (Nova avaliação, Tema da semana, Alunos, com a lista "Para fazer") e barra fixa embaixo (Início, Avaliar, Tema, Alunos). Fora do início, logo abaixo do cabeçalho fica uma faixa fixa com o botão de voltar, sempre visível ao rolar, com o nome de para onde leva (Início, Alunos ou Tema); na ficha de avaliação ele vira "Voltar" ou "Cancelar". A Nova avaliação começa pela busca do aluno: aluno novo faz a aula experimental, aluno da casa faz a reavaliação.
- **Tema claro e escuro:** o botão de sol/lua no cabeçalho troca o tema e guarda a escolha no aparelho; sem escolha, segue o modo escuro do celular. As cores das telas usam papéis (`--fundo`, `--cartao`, `--cartao2`, `--borda`, `--texto`, `--texto2`, `--texto3`, `--escuro`, `--acento`), definidos no início do CSS e trocados em `html[data-cor=escuro]`. No escuro, as cores se invertem: as faixas de cima e de baixo ficam creme (com o logo preto, `img/logo-preta.png`), o botão de voltar fica creme, o que é saibro vira verde-limão e as bolinhas pretas viram creme. O relatório em PDF e o post de parabéns usam as cores da marca direto e continuam claros.
- **Treinos por tema:** o ciclo de 6 temas semanais (Construir o ponto, Começar o ponto, Atacar e fechar, Defender e virar o jogo, Variar para desequilibrar, Competir), igual para todos os alunos. Na tela inicial, o Paulo escolhe o tema desta semana uma vez e o ciclo avança sozinho toda segunda-feira (depois do 6 volta ao 1); "Trocar tema" recomeça o ciclo a partir do tema escolhido. O ciclo fica salvo no índice do Drive (`ciclo`: segunda-feira de início e tema).
- **Treino da semana:** na ficha de cada aluno, "Montar treino da semana" pede ao Claude 3 ou 4 exercícios que juntam o tema da semana, o nível do aluno e o plano de treino da última avaliação (fase e semana do plano, pontos a melhorar e notas), com um "De olho" para o Paulo. O Claude parte do banco de exercícios (pelo menos 2 do banco, no máximo 1 novo). O treino fica salvo no aluno (últimas 12 semanas) e abrir de novo na mesma semana não gasta crédito; "Montar de novo" refaz. Quando o plano já terminou, o card avisa que é hora de reavaliar. O nível do banco vem da avaliação (classe confirmada diferente da sugerida muda o nível: 6ª e 5ª = Iniciante, 4ª a 2ª = Intermediário, 1ª = Avançado; Principiante usa a base de Iniciante, simplificada).
- **Economia do Claude no treino da semana:** (1) cada aluno tem um treino por semana, salvo, e abrir de novo não chama o Claude; (2) "Montar de novo" tem limite de 2 vezes por aluno por semana (propriedade `REFAZER_TREINO` muda o limite); (3) o treino usa um modelo mais barato que o do diagnóstico (`claude-haiku-5-5`, trocável pela propriedade `MODELO_TREINO`), com esforço baixo e resposta curta; (4) o script já ordena o banco pelo que o aluno mais precisa (notas mais baixas, golpes da fase atual do plano e dos pontos a melhorar, sem repetir as duas últimas semanas) e manda ao Claude só os 6 melhores; (5) se o Claude falhar ou o crédito acabar, o script monta o treino direto pelo banco, com a mesma ordem, e a página avisa ("Montado pelo banco"); (6) com a propriedade `MODO_TREINO` = `banco`, o treino é sempre montado pelo banco, sem gastar nada. O banco fica em cache por 10 minutos, um tema por vez (o cache do Apps Script guarda até 100 KB por item).
- **Banco de exercícios:** `professor/treinos-por-tema.json`, com os 6 temas (pergunta da semana, pilares, momento do jogo e um objetivo por nível) e 14 exercícios por tema e nível (Iniciante, Intermediário e Avançado), 252 no total. Os temas seguem as situações de jogo usadas pela ITF (sacar, devolver, trocar do fundo, ir à rede, passar e defender), e os exercícios para crianças e principiantes usam as bolas de transição do Play and Stay (adotado pela CBT na iniciação). Cada exercício tem `materiais` (cones, pratos, escada, elástico, corda, arcos, toalhas, bola laranja, bola verde), que aparecem no treino da semana.
- **Preparação da semana:** cada tema tem `preparacao` com alongamento (depois do treino ou em casa), aquecimento dinâmico (antes da aula) e sugestão de força (2 a 3 vezes na semana), igual para todos os alunos, e o aviso `avisoPreparacao` (sem dor, crianças só com o peso do corpo). Aparece na tela Tema.
- **Mensagem da semana:** na tela Tema (e no treino de cada aluno), a página monta a mensagem de WhatsApp do aluno, sem gastar o Claude: tema, pergunta da semana, os exercícios do treino dele (ou a técnica do tema, se o treino ainda não foi montado), o momento do jogo e a ligação com a fase do plano, e a preparação da semana. O Paulo pode editar o texto, abrir direto no WhatsApp do aluno (número cadastrado na ficha) ou copiar. Há também uma mensagem geral, sem nome, para grupo, lista de transmissão ou status. A página marca quem já recebeu a mensagem na semana (só neste aparelho). É uma proposta para o Paulo revisar: dá para editar nomes, descrições e doses ou acrescentar exercícios direto no arquivo, sem mexer no código. Cada exercício precisa de um `id` único e, em `golpes`, os nomes da ficha. O Apps Script lê o arquivo publicado no site (guarda por 10 minutos), então uma mudança no banco vale para os próximos treinos montados.
