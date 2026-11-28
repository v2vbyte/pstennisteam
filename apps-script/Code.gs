/**
 * PS Tennis Team · Área do professor · Apps Script
 *
 * É o "motor" da página pstennisteam.com/professor/. Roda na conta
 * pstennisteam@gmail.com e faz quatro coisas:
 *   1. Confere o login do Google (só as contas autorizadas entram).
 *   2. Chama o Claude para escrever o diagnóstico e o plano de treino.
 *   3. Guarda tudo no Google Drive: uma pasta por aluno, um Google Doc
 *      editável por aula e uma planilha com o registro das aulas.
 *   4. Avisa por e-mail a cada diagnóstico gerado.
 *   5. Guarda o tema da semana (ciclo de Treinos por tema) e monta, com o
 *      Claude, o treino da semana de cada aluno a partir do banco de
 *      exercícios do site (professor/treinos-por-tema.json).
 *
 * Propriedades do script (Configurações do projeto > Propriedades do script):
 *   ANTHROPIC_API_KEY   chave da API do Claude (obrigatória)
 *   GOOGLE_CLIENT_ID    ID do cliente OAuth do Google Cloud (obrigatória)
 *   EMAILS_AUTORIZADOS  e-mails que podem entrar, separados por vírgula (obrigatória)
 *   EMAIL_COPIA         e-mail que recebe cópia dos avisos (opcional)
 *   MODELO              modelo do Claude para o diagnóstico (opcional, padrão claude-sonnet-5-5)
 *   MODELO_TREINO       modelo do Claude para o treino da semana (opcional, padrão claude-haiku-5-5)
 *   MODO_TREINO         "banco" monta o treino da semana só pelo banco, sem chamar o Claude (opcional)
 *   REFAZER_TREINO      quantas vezes por semana dá para "Montar de novo" o treino de um aluno (opcional, padrão 2)
 * A função configurar() cria a pasta, a planilha e o índice e grava
 * PASTA_ID, PLANILHA_ID e INDICE_ID sozinha.
 */

const CFG = {
  PASTA: 'PS Tennis · Alunos',
  PLANILHA: 'PS Tennis · Registro de aulas',
  INDICE: 'indice-alunos.json',
  MODELO_PADRAO: 'claude-sonnet-5-5',
  MODELO_TREINO_PADRAO: 'claude-haiku-5-5',
  REFAZER_TREINO_PADRAO: 2,
  EXERCICIOS_PARA_O_CLAUDE: 6,
  SITE: 'https://www.pstennisteam.com/professor/',
  BANCO: 'https://www.pstennisteam.com/professor/treinos-por-tema.json',
  FUSO: 'America/Sao_Paulo'
};
const CLASSES = ['6ª', '5ª', '4ª', '3ª', '2ª', '1ª'];
const GOLPES = ['Forehand', 'Backhand', 'Saque', 'Devolução', 'Voleio', 'Smash', 'Lob e passada', 'Movimentação', 'Consistência', 'Efeitos', 'Tática'];
const FASES = ['Preparação', 'Lançamento', 'Troféu', 'Contato', 'Terminação'];
/* Colunas da planilha de registro. O script acha cada coluna pelo nome do
   cabeçalho, então dá para reordenar ou acrescentar colunas sem quebrar nada
   (só não renomeie as que já existem). */
const CABECALHO = ['Data', 'Aluno', 'Idade', 'Local', 'Tipo', 'Objetivo', 'Tempo de prática', 'Experiência em jogo', 'Nível',
  'Classe anterior', 'Classe pelas notas', 'Classe sugerida', 'Classe confirmada', 'Média', 'ITN', 'Itens avaliados']
  .concat(GOLPES.map(g => 'Nota · ' + g))
  .concat(['Tem vídeo do saque', 'Indicação do professor', 'Diagnóstico (Doc)', 'PDF do relatório', 'Pasta do aluno', 'ID do aluno', 'ID da aula']);

/* =====================================================================
   CONFIGURAÇÃO (rodar uma vez pelo editor)
   ===================================================================== */
function configurar() {
  const P = PropertiesService.getScriptProperties();
  let pasta = null;
  try { if (P.getProperty('PASTA_ID')) pasta = DriveApp.getFolderById(P.getProperty('PASTA_ID')); } catch (e) { pasta = null; }
  if (!pasta) {
    const it = DriveApp.getFoldersByName(CFG.PASTA);
    pasta = it.hasNext() ? it.next() : DriveApp.createFolder(CFG.PASTA);
    P.setProperty('PASTA_ID', pasta.getId());
  }
  let planilhaOk = false;
  try { if (P.getProperty('PLANILHA_ID')) { SpreadsheetApp.openById(P.getProperty('PLANILHA_ID')); planilhaOk = true; } } catch (e) { planilhaOk = false; }
  if (!planilhaOk) {
    const ss = SpreadsheetApp.create(CFG.PLANILHA);
    const aba = ss.getSheets()[0];
    aba.setName('Aulas');
    aba.getRange(1, 1, 1, CABECALHO.length).setValues([CABECALHO]).setFontWeight('bold');
    aba.setFrozenRows(1);
    DriveApp.getFileById(ss.getId()).moveTo(pasta);
    P.setProperty('PLANILHA_ID', ss.getId());
  }
  let indiceOk = false;
  try { if (P.getProperty('INDICE_ID')) { DriveApp.getFileById(P.getProperty('INDICE_ID')); indiceOk = true; } } catch (e) { indiceOk = false; }
  if (!indiceOk) {
    const f = pasta.createFile(CFG.INDICE, JSON.stringify({ alunos: [] }), 'application/json');
    P.setProperty('INDICE_ID', f.getId());
  }
  const faltando = ['ANTHROPIC_API_KEY', 'GOOGLE_CLIENT_ID', 'EMAILS_AUTORIZADOS'].filter(k => !prop(k));
  Logger.log('Pasta: ' + pasta.getUrl());
  Logger.log('Planilha: ' + SpreadsheetApp.openById(P.getProperty('PLANILHA_ID')).getUrl());
  Logger.log(faltando.length ? 'ATENÇÃO, faltam estas propriedades do script: ' + faltando.join(', ') : 'Tudo certo. Agora é só implantar como App da Web.');
}

/* Teste rápido da chave do Claude (rodar pelo editor, se quiser) */
function testarClaude() {
  const r = chamarAnthropic({ model: modelo(), max_tokens: 20, messages: [{ role: 'user', content: 'Responda só: ok' }] });
  Logger.log('Claude respondeu: ' + r.content.map(b => b.text || '').join(''));
}

/* Teste completo do texto, sem mexer no Drive (rodar pelo editor) */
function testarDiagnostico() {
  const av = {
    nome: 'Aluno Teste', idade: '30', local: 'Fama Tennis', objetivo: 'Jogar partidas', tempo: '1 a 3 anos', experiencia: 'Joga com amigos',
    mao: 'Destro', backhand: 'Duas mãos', empunhadura: 'Eastern', nivel: 'Iniciante',
    golpes: { Forehand: { nota: 5, obs: 'contato atrasado em bola rápida' }, Backhand: { nota: 4, obs: '' }, Saque: { nota: 3, obs: 'lançamento irregular' }, Movimentação: { nota: 6, obs: '' }, Consistência: { nota: 4, obs: '' } },
    fortes: 'se movimenta bem e tem vontade', melhorar: 'saque e backhand', gerais: 'fica nervoso quando o placar aperta', quadros: []
  };
  const cal = { media: 4.3, itn: 7.5, classe: '4ª', nivel: 'Iniciante' };
  const t0 = Date.now();
  const r = escreverComClaude(av, cal, 'experimental', null, '', []);
  if (r.uso) Logger.log('Tokens de saída: diagnóstico ' + r.uso[0] + ', plano ' + r.uso[1]);
  Logger.log('Tempo: ' + Math.round((Date.now() - t0) / 1000) + ' segundos');
  Logger.log('Classe sugerida: ' + r.diagnostico.classeSugerida + ' (calculada pelas notas: 4ª)');
  Logger.log('Resumo: ' + r.diagnostico.resumo);
  Logger.log('Justificativa: ' + r.diagnostico.justificativa);
  Logger.log('Plano: ' + r.plano.planoTitulo + ' · ' + (r.plano.plano || []).map(f => f.semanas + ' ' + f.titulo).join(' | '));
  Logger.log('Tudo certo: o motor conversa com o Claude.');
}

/* =====================================================================
   ENTRADA DA PÁGINA
   ===================================================================== */
function doGet() {
  return ContentService.createTextOutput('PS Tennis · Área do professor: serviço no ar.');
}

function doPost(e) {
  let saida;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const email = verificarLogin(req.token);
    const acao = ACOES[req.action];
    if (!acao) throw publico('Ação desconhecida.');
    saida = Object.assign({ ok: true }, acao(req, email) || {});
  } catch (err) {
    if (!err.publico && !err.sessao) console.error(err && err.stack ? err.stack : err);
    saida = { ok: false, erro: err.sessao ? 'sessao' : err.publico ? err.message : 'Erro no servidor (' + (err && err.message ? err.message : err) + ')' };
  }
  return ContentService.createTextOutput(JSON.stringify(saida)).setMimeType(ContentService.MimeType.JSON);
}

const ACOES = {
  entrar: (req, email) => { const idx = lerIndice(); return { email: email, alunos: idx.alunos.map(paraPagina), ciclo: idx.ciclo || null }; },
  gerar: gerar,
  confirmarClasse: confirmarClasse,
  ler: ler,
  salvarPdf: salvarPdf,
  definirTema: definirTema,
  treinoSemana: treinoSemana
};

/* =====================================================================
   LOGIN DO GOOGLE
   ===================================================================== */
function verificarLogin(token) {
  if (!token) throw sessao();
  const cache = CacheService.getScriptCache();
  const chave = 'tk_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 43);
  const salvo = cache.get(chave);
  if (salvo) return salvo;
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw sessao();
  const t = JSON.parse(r.getContentText());
  const exp = Number(t.exp) * 1000;
  if (t.aud !== prop('GOOGLE_CLIENT_ID')) throw sessao();
  if (t.iss !== 'accounts.google.com' && t.iss !== 'https://accounts.google.com') throw sessao();
  if (String(t.email_verified) !== 'true' || !t.email) throw sessao();
  if (!exp || exp < Date.now()) throw sessao();
  const email = String(t.email).toLowerCase();
  if (autorizados().indexOf(email) < 0) throw publico('A conta ' + email + ' não tem acesso à área do professor.');
  const segundos = Math.floor((exp - Date.now()) / 1000) - 30;
  if (segundos > 60) cache.put(chave, email, Math.min(segundos, 3000));
  return email;
}
const autorizados = () => prop('EMAILS_AUTORIZADOS').split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);

/* =====================================================================
   GERAR DIAGNÓSTICO
   ===================================================================== */
function gerar(req) {
  const av = req.avaliacao || {};
  const tipo = req.tipo === 'reavaliacao' ? 'reavaliacao' : 'experimental';
  const nome = String(av.nome || '').trim();
  if (nome.length < 2) throw publico('Falta o nome do aluno.');
  if (!av.consent) throw publico('Falta a autorização do aluno.');
  const cal = req.calibragem;
  if (!cal || CLASSES.indexOf(cal.classe) < 0) throw publico('Dê a nota de pelo menos um golpe para calcular a classe.');

  /* aula anterior (reavaliação) */
  let alunoBase = null, anterior = null, antCompleta = null;
  if (req.alunoId) {
    alunoBase = lerIndice().alunos.filter(a => a.id === req.alunoId)[0];
    if (!alunoBase) throw publico('Aluno não encontrado. Atualize a página e tente de novo.');
    anterior = alunoBase.aulas[alunoBase.aulas.length - 1];
    antCompleta = anterior ? lerArquivoAula(anterior).diag : null;
  }
  const antClasse = anterior ? (anterior.diag.classe && (anterior.diag.classe.confirmada || anterior.diag.classe.sugerida)) || '' : (CLASSES.indexOf(av.classeAtual) >= 0 ? av.classeAtual : '');
  const quadros = (av.quadros || []).filter(q => q && q.img).slice(0, 5);

  /* 1. Claude */
  const ia = escreverComClaude(av, cal, tipo, antCompleta, antClasse, quadros);

  /* 2. Monta o diagnóstico no formato que a página usa */
  const data = Utilities.formatDate(new Date(), CFG.FUSO, 'dd/MM/yyyy');
  const notas = GOLPES.filter(g => av.golpes && av.golpes[g] && av.golpes[g].nota).map(g => ({ golpe: g, nota: Number(av.golpes[g].nota) }));
  const p1 = ia.diagnostico, p2 = ia.plano;
  const sugerida = classesVizinhas(cal.classe).indexOf(p1.classeSugerida) >= 0 ? p1.classeSugerida : cal.classe;
  const diag = {
    tipo: tipo,
    aluno: {
      nome: nome, idade: av.idade || '', data: data, local: av.local || '', objetivo: av.objetivo || '', tempo: av.tempo || '',
      experiencia: av.experiencia || '', mao: av.mao || '', backhand: av.backhand || '', empunhadura: av.empunhadura || '', nivel: av.nivel || cal.nivel || ''
    },
    resumo: p1.resumo,
    notas: notas,
    classe: { sugerida: sugerida, calculada: cal.classe, confirmada: '', anterior: antClasse, media: cal.media, itn: cal.itn, nivel: cal.nivel, justificativa: p1.justificativa },
    fortes: lista(p1.fortes, 3),
    melhorar: lista(p1.melhorar, 3),
    golpes: (p1.golpes || []).filter(g => g && GOLPES.indexOf(g.golpe) >= 0).slice(0, 4).map(g => ({
      golpe: g.golpe, nota: (notas.filter(n => n.golpe === g.golpe)[0] || {}).nota || 0, vi: g.vi || '', corrigir: g.corrigir || '', exercicio: g.exercicio || ''
    })),
    saque: null,
    planoTitulo: p2.planoTitulo || (tipo === 'reavaliacao' ? 'Próximo ciclo · 8 semanas · 1 aula por semana' : '12 semanas · 1 aula por semana'),
    plano: (p2.plano || []).map(f => ({ semanas: f.semanas || '', titulo: f.titulo || '', reavaliacao: !!f.reavaliacao, itens: (f.itens || []).map(i => ({ foco: i.foco || '', exercicio: i.exercicio || '' })) })),
    casa: lista(p2.casa, 3),
    equipamento: { raquete: textoRaquete(av), obs: p2.equipamentoObs || '' },
    proximo: { recomendacao: (p2.proximo || {}).recomendacao || '', motivo: (p2.proximo || {}).motivo || '', texto: (p2.proximo || {}).texto || '' }
  };
  if (quadros.length) {
    const sq = p1.saque || {};
    diag.saque = {
      quadros: quadros.map(q => ({ fase: q.fase, img: q.img, obs: ((sq.quadros || []).filter(x => x.fase === q.fase)[0] || {}).obs || '' })),
      bom: sq.bom || '', prioridade: sq.prioridade || ''
    };
  }
  if (anterior) diag.anterior = { data: anterior.data, notas: anterior.diag.notas || [], classe: antClasse };

  /* 3. Aluno no índice (cria a pasta, se for novo) */
  const alunoId = comTrava(() => {
    const idx = lerIndice();
    let al = req.alunoId ? idx.alunos.filter(a => a.id === req.alunoId)[0] : null;
    if (!al) {
      const id = novoId();
      const pasta = pastaRaiz().createFolder(nome);
      al = { id: id, nome: nome, idade: '', whatsapp: '', local: '', classe: '', pastaId: pasta.getId(), aulas: [] };
      idx.alunos.push(al);
    }
    al.idade = av.idade || al.idade; al.whatsapp = av.whatsapp || al.whatsapp; al.local = av.local || al.local;
    salvarIndice(idx);
    return al.id;
  });
  const alInfo = lerIndice().alunos.filter(a => a.id === alunoId)[0];
  const pasta = DriveApp.getFolderById(alInfo.pastaId);

  /* 4. Google Doc editável + arquivo completo da aula */
  const aulaId = novoId();
  const doc = criarDoc(diag, pasta);
  const arq = pasta.createFile('aula-' + aulaId + '.json', JSON.stringify({ diag: diag, av: avLeve(av), docId: doc.id }), 'application/json');

  /* 5. Registra a aula no índice */
  const al = comTrava(() => {
    const idx = lerIndice();
    const a = idx.alunos.filter(x => x.id === alunoId)[0];
    a.aulas.push({ id: aulaId, tipo: tipo, data: data, docUrl: doc.url, docId: doc.id, docVersao: doc.versao, arquivoId: arq.getId(), diag: diagLeve(diag), av: avLeve(av) });
    salvarIndice(idx);
    return a;
  });

  /* 6. Planilha e e-mail (se falharem, o diagnóstico continua salvo) */
  try { registrarPlanilha(al, al.aulas[al.aulas.length - 1], pasta, diag); } catch (e) { console.error('Planilha: ' + e); }
  try { avisarPorEmail(al, diag, doc.url, pasta.getUrl()); } catch (e) { console.error('E-mail: ' + e); }

  return { aluno: paraPagina(al) };
}

/* =====================================================================
   CLAUDE
   ===================================================================== */
const SISTEMA = [
  'Você escreve o diagnóstico de tênis que o professor Paulo Santana (PS Tennis Team, Belo Horizonte) entrega ao aluno depois de uma aula experimental ou de uma reavaliação.',
  'Escreva como o Paulo, falando direto com o aluno ("você"), em português do Brasil. Tom próximo, confiante e direto. Explique termos técnicos de forma simples, na primeira vez que aparecerem.',
  'Quem lê é o aluno. O texto é o Paulo falando com ele, em primeira pessoa quando fala de si ("vi que", "vamos trabalhar").',
  'Regras:',
  '- Nunca fale do professor em terceira pessoa ("o professor observou") e nunca mostre os bastidores: não mencione a ficha, as observações, a classe calculada, ajustes de classe, a média ponderada como cálculo, o sistema nem você mesmo.',
  '- Os dados do perfil (tempo de prática, experiência em jogo, objetivo, nível) são contexto. Não copie as opções da ficha ao pé da letra (nada de "uma base de 1 a 3 anos jogando com amigos"): use em linguagem natural, só quando ajudar, ou deixe de fora.',
  '- Baseie-se só nas notas, nas observações do professor e nos quadros do saque. Não invente fatos que não estejam na ficha (torneios, lesões, tempo de prática, resultados).',
  '- Quando um item não tiver observação, apoie-se na nota e fale com cuidado, sem detalhes que você não viu.',
  '- Frases curtas e concretas. Nada de elogio vazio nem frases genéricas de autoajuda.',
  '- Nunca use travessão (—) nem meia-risca (–) como pontuação. Use vírgula, dois-pontos ou ponto. Não use emojis.',
  '- Não fale de preços.',
  '- Exercícios realistas para uma aula de tênis, com séries e repetições ou tempo.',
  '- As notas vão de 1 a 10. A classe segue o ITN da ITF (6ª classe = iniciante, 1ª = mais avançada).',
  '- A média ponderada das notas dá a classe calculada, que é o ponto de partida. Use as observações do professor (por golpe, pontos fortes, pontos a melhorar, jogo e competição) para confirmar essa classe ou ajustá-la em no máximo uma classe para cima ou para baixo. Ajuste só quando as observações mostrarem algo que as notas não captam (por exemplo, experiência em partidas, comportamento sob pressão, consistência muito acima ou abaixo das notas). Esse procedimento é interno: o texto para o aluno nunca o descreve.'
].join('\n');

function escreverComClaude(av, cal, tipo, antDiag, antClasse, quadros) {
  const contexto = montarContexto(av, cal, tipo, antDiag, antClasse, quadros);
  const reav = tipo === 'reavaliacao';
  const conteudo1 = [{ type: 'text', text: contexto }];
  quadros.forEach((q, i) => {
    const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(q.img || '');
    if (m) { conteudo1.push({ type: 'text', text: 'Quadro ' + (i + 1) + ' do saque: ' + q.fase }); conteudo1.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }); }
  });
  conteudo1.push({ type: 'text', text: 'Escreva agora a parte do diagnóstico, no formato JSON pedido.' + (quadros.length ? ' Analise os quadros do saque.' : ' Não há vídeo do saque nesta aula: não inclua o campo "saque".') });

  /* Saída estruturada: o Claude responde um JSON que segue o esquema */
  /* Sem raciocínio prévio (between_tools): a resposta sai mais rápida e o
     raciocínio não consome o limite de tamanho; o Apps Script corta em ~60 s */
  const p1 = {
    model: modelo(), max_tokens: 8000, system: SISTEMA, thinking: { type: 'between_tools' },
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: esquemaFechado(ESQUEMA_DIAGNOSTICO(reav, classesVizinhas(cal.classe))) } },
    messages: [{ role: 'user', content: conteudo1 }]
  };
  const p2 = {
    model: modelo(), max_tokens: 6000, system: SISTEMA, thinking: { type: 'between_tools' },
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: esquemaFechado(ESQUEMA_PLANO(reav)) } },
    messages: [{ role: 'user', content: contexto + '\n\n' + (reav
      ? 'Monte o PRÓXIMO CICLO de 8 semanas, com 2 fases de 4 semanas e 3 itens cada. Continue a numeração das semanas a partir do plano anterior (se a reavaliação foi ao fim da semana 8, comece na semana 9). Marque a última fase com reavaliacao = true. Ataque primeiro o "Foco do próximo ciclo" e as notas mais baixas.'
      : 'Monte um plano de 12 semanas, com 3 fases de 4 semanas (Semanas 1 a 4, 5 a 8, 9 a 12) e 3 itens cada. A primeira fase ataca os pontos a melhorar e as notas mais baixas; a última leva para o jogo. Marque a fase 2 com reavaliacao = true (reavaliação ao fim da semana 8).') +
      ' Considere 1 aula por semana. Na recomendação, use uma das modalidades: aula individual, em dupla ou em grupo (4 pessoas), 1 vez por semana. Responda no formato JSON pedido.' }]
  };
  const r = chamarAnthropicVarios([p1, p2]);
  const d = lerJson(r[0]), p = lerJson(r[1]);
  /* o esquema não garante maiúsculas e minúsculas nos valores fixos */
  const igual = (lista, v) => lista.filter(x => x.toLowerCase() === String(v || '').trim().toLowerCase())[0] || null;
  d.classeSugerida = igual(CLASSES, d.classeSugerida);
  d.golpes = (d.golpes || []).map(g => Object.assign({}, g, { golpe: igual(GOLPES, g.golpe) || g.golpe }));
  if (d.saque) d.saque.quadros = (d.saque.quadros || []).map(q => Object.assign({}, q, { fase: igual(FASES, q.fase) || q.fase }));
  const uso = r.map(x => (x.usage || {}).output_tokens || 0);
  console.log('Claude · tokens de saída: ' + uso.join(' + '));
  return { diagnostico: d, plano: p, uso: uso };
}

function montarContexto(av, cal, tipo, antDiag, antClasse, quadros) {
  const L = [];
  const reav = tipo === 'reavaliacao';
  const t = v => (v === undefined || v === null || v === '') ? 'não informado' : String(v);
  L.push('TIPO DE AULA: ' + (reav ? 'Reavaliação' : 'Aula experimental (primeira aula, diagnóstico inicial)'));
  L.push('');
  L.push('ALUNO');
  L.push('Nome: ' + t(av.nome) + ' | Idade: ' + t(av.idade) + ' | Local: ' + t(av.local));
  L.push('Objetivo: ' + t(av.objetivo) + ' | Tempo de prática: ' + t(av.tempo) + ' | Experiência em jogo: ' + t(av.experiencia));
  L.push('Mão: ' + t(av.mao) + ' | Backhand: ' + t(av.backhand) + ' | Empunhadura do forehand: ' + t(av.empunhadura));
  L.push('Nível geral marcado pelo professor: ' + t(av.nivel) + (reav ? '' : ' | Classe declarada pelo aluno: ' + t(av.classeAtual)));
  L.push('');
  L.push('CLASSE CALCULADA PELAS NOTAS: média ponderada ' + String(cal.media).replace('.', ',') + ', referência ITN ' + String(cal.itn).replace('.', ',') + ', nível ' + cal.nivel + ', classe sugerida ' + cal.classe + (antClasse ? ' (classe anterior: ' + antClasse + ')' : '') + '.');
  L.push('');
  L.push('NOTAS (1 a 10) E OBSERVAÇÕES DO PROFESSOR POR ITEM');
  GOLPES.forEach(g => {
    const x = (av.golpes || {})[g] || {};
    if (x.nota || x.obs) L.push('- ' + g + ': ' + (x.nota ? 'nota ' + x.nota : 'sem nota') + (x.obs ? '. Observação: ' + x.obs : ''));
  });
  L.push('');
  L.push('OBSERVAÇÕES GERAIS DO PROFESSOR');
  L.push((reav ? 'O que evoluiu: ' : 'Pontos fortes: ') + t(av.fortes));
  L.push((reav ? 'Foco do próximo ciclo: ' : 'Pontos a melhorar: ') + t(av.melhorar));
  L.push('Jogo e competição: ' + t(av.gerais));
  L.push('');
  L.push('EQUIPAMENTO: ' + (av.semRaquete ? 'o aluno não tem raquete própria (usou raquete emprestada). ' : '') + textoRaquete(av));
  if (antDiag) {
    L.push('');
    L.push('AVALIAÇÃO ANTERIOR (' + t(antDiag.aluno && antDiag.aluno.data) + ', classe ' + t(antClasse) + ')');
    L.push('Notas: ' + (antDiag.notas || []).map(n => n.golpe + ' ' + n.nota).join(', '));
    L.push('Resumo: ' + t(antDiag.resumo));
    L.push('Pontos que eram prioridade: ' + (antDiag.melhorar || []).join(' | '));
    if (antDiag.saque && antDiag.saque.prioridade) L.push('Prioridade do saque: ' + antDiag.saque.prioridade);
    L.push('Plano anterior: ' + t(antDiag.planoTitulo) + '. ' + (antDiag.plano || []).map(f => f.semanas + ' (' + f.titulo + (f.reavaliacao ? ', com reavaliação' : '') + ')').join('; '));
  }
  L.push('');
  L.push(quadros.length ? 'VÍDEO DO SAQUE: ' + quadros.length + ' quadros anexados, nas fases: ' + quadros.map(q => q.fase).join(', ') + '.' : 'VÍDEO DO SAQUE: não houve nesta aula.');
  return L.join('\n');
}

const ESQUEMA_DIAGNOSTICO = (reav, opcoesClasse) => ({
  type: 'object',
  properties: {
    classeSugerida: { type: 'string', enum: opcoesClasse, description: 'A classe calculada pelas notas, ou uma acima ou abaixo se as observações do professor justificarem.' },
    resumo: { type: 'string', description: reav ? '3 a 4 frases para o aluno: o que mudou desde a última avaliação, a classe e o rumo do próximo ciclo.' : '3 a 4 frases para o aluno: o que ele já faz bem, o que mais segura o jogo hoje e a meta das próximas 12 semanas.' },
    justificativa: { type: 'string', description: '2 a 4 frases para o aluno, na voz do Paulo: em que classe ele está e por quê, ligando o que se vê no jogo dele à descrição do nível ITN, e o que falta para a próxima classe. Pode dizer de forma simples que as notas ficaram na faixa dessa classe. Só se a classe sugerida for diferente da classe pelas notas, explique em uma frase, pelo jogo do aluno, por que ele está uma classe acima ou abaixo (ex.: "pelas notas, você ficaria na 5ª, mas a firmeza nos pontos disputados já é de 4ª"). Se forem iguais, não fale de ajuste.' },
    fortes: { type: 'array', items: { type: 'string' }, description: reav ? '3 itens: o que evoluiu, cada um com o golpe e o efeito prático.' : '3 pontos fortes, cada um com o golpe e o efeito prático.' },
    melhorar: { type: 'array', items: { type: 'string' }, description: reav ? '3 itens: foco do próximo ciclo.' : '3 pontos a melhorar, cada um com o golpe, o que acontece e a consequência.' },
    golpes: {
      type: 'array', description: 'De 3 a 4 itens mais relevantes (notas mais baixas ou com observação do professor).',
      items: {
        type: 'object',
        properties: {
          golpe: { type: 'string', enum: GOLPES },
          vi: { type: 'string', description: 'O que o professor viu, 1 a 2 frases.' },
          corrigir: { type: 'string', description: 'Como corrigir, 1 frase com uma instrução clara.' },
          exercicio: { type: 'string', description: 'Um exercício com séries e repetições ou tempo.' }
        },
        required: ['golpe', 'vi', 'corrigir', 'exercicio']
      }
    },
    saque: {
      type: 'object', description: 'Só quando houver quadros do saque.',
      properties: {
        quadros: { type: 'array', items: { type: 'object', properties: { fase: { type: 'string', enum: FASES }, obs: { type: 'string', description: 'O que se vê no quadro, 1 frase.' } }, required: ['fase', 'obs'] } },
        bom: { type: 'string', description: 'O que já está bom no saque, 1 a 2 frases.' },
        prioridade: { type: 'string', description: 'O foco das próximas aulas no saque, 1 a 2 frases.' }
      },
      required: ['quadros', 'bom', 'prioridade']
    }
  },
  required: ['classeSugerida', 'resumo', 'justificativa', 'fortes', 'melhorar', 'golpes']
});

const ESQUEMA_PLANO = reav => ({
  type: 'object',
  properties: {
    planoTitulo: { type: 'string', description: reav ? 'Ex.: Próximo ciclo · 8 semanas · 1 aula por semana' : 'Ex.: 12 semanas · 1 aula por semana' },
    plano: {
      type: 'array', description: reav ? '2 fases.' : '3 fases.',
      items: {
        type: 'object',
        properties: {
          semanas: { type: 'string', description: 'Ex.: Semanas 1 a 4' },
          titulo: { type: 'string', description: 'Nome curto da fase, 1 a 3 palavras.' },
          reavaliacao: { type: 'boolean' },
          itens: { type: 'array', items: { type: 'object', properties: { foco: { type: 'string', description: 'O que trabalhar, poucas palavras.' }, exercicio: { type: 'string', description: 'O exercício, 1 frase.' } }, required: ['foco', 'exercicio'] } }
        },
        required: ['semanas', 'titulo', 'reavaliacao', 'itens']
      }
    },
    casa: { type: 'array', items: { type: 'string' }, description: '2 tarefas para fazer em casa, sem quadra, com tempo ou repetições.' },
    equipamentoObs: { type: 'string', description: '1 a 2 frases sobre a raquete do aluno para o momento dele. Se ele não tem raquete, oriente o que procurar.' },
    proximo: {
      type: 'object',
      properties: {
        recomendacao: { type: 'string', description: 'Ex.: Aula individual, 1 vez por semana' },
        motivo: { type: 'string', description: '1 frase com o porquê dessa indicação.' },
        texto: { type: 'string', description: '2 frases de fechamento: o que vem na próxima aula e quando é a próxima reavaliação.' }
      },
      required: ['recomendacao', 'motivo', 'texto']
    }
  },
  required: ['planoTitulo', 'plano', 'casa', 'equipamentoObs', 'proximo']
});

function chamarAnthropic(corpo) { return chamarAnthropicVarios([corpo])[0]; }

/* Chama o Claude em paralelo (o Apps Script corta cada chamada em ~60 s) */
function chamarAnthropicVarios(corpos) {
  const chave = prop('ANTHROPIC_API_KEY');
  if (!chave) throw publico('Falta configurar a chave do Claude no Apps Script.');
  const req = c => ({
    url: 'https://api.anthropic.com/v1/messages', method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01' }, payload: JSON.stringify(c)
  });
  let resultados = new Array(corpos.length), pendentes = corpos.map((c, i) => i);
  for (let tentativa = 0; tentativa < 2 && pendentes.length; tentativa++) {
    if (tentativa) Utilities.sleep(4000);
    let resps;
    try { resps = UrlFetchApp.fetchAll(pendentes.map(i => req(corpos[i]))); }
    catch (e) { if (tentativa) throw publico('O Claude demorou demais para responder. Toque em "Tentar de novo".'); continue; }
    const ainda = [];
    resps.forEach((r, k) => {
      const i = pendentes[k], cod = r.getResponseCode();
      if (cod === 200) { resultados[i] = JSON.parse(r.getContentText()); return; }
      if (cod === 429 || cod === 500 || cod === 529 || cod === 503) { ainda.push(i); return; }
      let msg = ''; try { msg = JSON.parse(r.getContentText()).error.message; } catch (e) { msg = r.getContentText().slice(0, 200); }
      if (cod === 401) throw publico('A chave do Claude foi recusada. Confira a ANTHROPIC_API_KEY no Apps Script.');
      if (cod === 400 && /credit/i.test(msg)) throw publico('Acabou o crédito da API do Claude. Recarregue em platform.claude.com.');
      throw publico('O Claude recusou o pedido (' + cod + '): ' + msg);
    });
    pendentes = ainda;
  }
  if (pendentes.length) throw publico('O Claude está sobrecarregado agora. Espere um minuto e toque em "Tentar de novo".');
  return resultados;
}

function lerJson(resp) {
  if (resp.stop_reason === 'max_tokens') throw publico('O texto do Claude ficou longo demais e foi cortado. Toque em "Tentar de novo".');
  const txt = (resp.content || []).filter(x => x.type === 'text').map(x => x.text).join('');
  let obj;
  try { obj = JSON.parse(txt); } catch (e) { throw publico('O Claude não devolveu o texto completo. Toque em "Tentar de novo".'); }
  return limparTravessoes(obj);
}
/* A saída estruturada exige additionalProperties: false em todo objeto */
function esquemaFechado(e) {
  if (Array.isArray(e)) return e.map(esquemaFechado);
  if (!e || typeof e !== 'object') return e;
  const o = {};
  Object.keys(e).forEach(k => o[k] = esquemaFechado(e[k]));
  if (o.type === 'object') o.additionalProperties = false;
  return o;
}
/* Garante a regra da marca: nada de travessão no texto */
function limparTravessoes(v) {
  if (typeof v === 'string') return v.replace(/(\d)\s*[–—]\s*(\d)/g, '$1 a $2').replace(/\s*[—–]\s*/g, ', ').replace(/,\s*,/g, ',').replace(/,\s*([.!?])/g, '$1').trim();
  if (Array.isArray(v)) return v.map(limparTravessoes);
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(k => o[k] = limparTravessoes(v[k])); return o; }
  return v;
}

/* =====================================================================
   CONFIRMAR CLASSE E LER (com as edições do Google Doc)
   ===================================================================== */
function confirmarClasse(req) {
  if (CLASSES.indexOf(req.classe) < 0) throw publico('Classe inválida.');
  const r = comTrava(() => {
    const idx = lerIndice();
    const al = idx.alunos.filter(a => a.id === req.alunoId)[0];
    const au = al && al.aulas.filter(a => a.id === req.aulaId)[0];
    if (!au) throw publico('Aula não encontrada. Atualize a página.');
    const arq = lerArquivoAula(au);
    [au.diag, arq.diag].forEach(d => {
      d.classe.confirmada = req.classe;
      if (d.classe.sugerida !== req.classe) d.resumoNota = 'Classe confirmada pelo professor: ' + req.classe + '.'; else delete d.resumoNota;
    });
    al.classe = req.classe;
    DriveApp.getFileById(au.arquivoId).setContent(JSON.stringify(arq));
    salvarIndice(idx);
    return { al: al, au: au };
  });
  try { atualizarPlanilha(r.au.id, 'Classe confirmada', req.classe); } catch (e) { console.error('Planilha: ' + e); }
  return {};
}

function ler(req) {
  const idx = lerIndice();
  const al = idx.alunos.filter(a => a.id === req.alunoId)[0];
  const au = al && al.aulas.filter(a => a.id === req.aulaId)[0];
  if (!au) throw publico('Aula não encontrada. Atualize a página.');
  const arq = lerArquivoAula(au);
  if (au.docId) {
    let versao = 0;
    try { versao = DriveApp.getFileById(au.docId).getLastUpdated().getTime(); } catch (e) { versao = 0; }
    if (versao && versao > (au.docVersao || 0) + 3000) {
      arq.diag = aplicarEdicoesDoDoc(arq.diag, au.docId);
      comTrava(() => {
        const idx2 = lerIndice();
        const a2 = idx2.alunos.filter(a => a.id === req.alunoId)[0].aulas.filter(a => a.id === req.aulaId)[0];
        DriveApp.getFileById(a2.arquivoId).setContent(JSON.stringify(arq));
        a2.diag = diagLeve(arq.diag); a2.docVersao = versao;
        salvarIndice(idx2);
      });
    }
  }
  return { diagnostico: arq.diag, versao: versaoDiag(arq.diag), pdfVersao: au.pdfVersao || '', pdfUrl: au.pdfUrl || '' };
}

/* =====================================================================
   PDF DO RELATÓRIO NA PASTA DO ALUNO
   O PDF com a identidade visual é montado no navegador (a página manda o
   arquivo pronto). A cada mudança no diagnóstico (classe confirmada ou
   edição no Google Doc), a página manda um novo PDF: o antigo vai para a
   lixeira do Drive e o novo fica no lugar.
   ===================================================================== */
function salvarPdf(req) {
  const m = /^data:application\/pdf[^,]*;base64,(.+)$/.exec(String(req.pdf || ''));
  if (!m) throw publico('PDF inválido.');
  const bytes = Utilities.base64Decode(m[1]);
  if (bytes.length > 25 * 1024 * 1024) throw publico('PDF grande demais.');
  const r = comTrava(() => {
    const idx = lerIndice();
    const al = idx.alunos.filter(a => a.id === req.alunoId)[0];
    const au = al && al.aulas.filter(a => a.id === req.aulaId)[0];
    if (!au) throw publico('Aula não encontrada. Atualize a página.');
    const atual = versaoDiag(lerArquivoAula(au).diag);
    if (req.versao !== atual) return { ignorado: true, pdfUrl: au.pdfUrl || '' };   /* o diagnóstico mudou enquanto o PDF era montado */
    if (au.pdfId) { try { DriveApp.getFileById(au.pdfId).setTrashed(true); } catch (e) {} }
    const nome = au.tipo === 'reavaliacao' ? 'Reavaliação - ' + al.nome + ' - ' + au.data.replace(/\//g, '-') + '.pdf' : 'Avaliação - ' + al.nome + '.pdf';
    const f = DriveApp.getFolderById(al.pastaId).createFile(Utilities.newBlob(bytes, 'application/pdf', nome));
    /* a versão guarda o diagnóstico e o layout do PDF: mudar qualquer um dos dois pede PDF novo */
    au.pdfId = f.getId(); au.pdfUrl = f.getUrl(); au.pdfVersao = atual + '|' + String(req.layout || '').slice(0, 20);
    salvarIndice(idx);
    return { pdfUrl: au.pdfUrl, aulaId: au.id };
  });
  if (!r.ignorado) { try { atualizarPlanilha(r.aulaId, 'PDF do relatório', r.pdfUrl); } catch (e) { console.error('Planilha: ' + e); } }
  return { pdfUrl: r.pdfUrl, ignorado: !!r.ignorado };
}
const versaoDiag = d => Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(d), Utilities.Charset.UTF_8).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');

/* =====================================================================
   GOOGLE DOC: criar e ler de volta
   ===================================================================== */
const SECOES = {
  resumo: ['Resumo'], classe: ['Classe sugerida'], fortes: ['Pontos fortes', 'O que evoluiu'], melhorar: ['Pontos a melhorar', 'Foco do próximo ciclo'],
  golpes: ['Golpes'], saque: ['Saque'], plano: ['Plano de treino'], casa: ['Para fazer em casa'], raquete: ['Sua raquete'], proximo: ['Próximo passo']
};
const ROTULOS = {
  vi: 'O que eu vi:', corrigir: 'Como corrigir:', exercicio: 'Exercício:', bom: 'O que já está bom:', prioridade: 'Prioridade:',
  titulo: 'Título do plano:', raquete: 'Raquete:', obs: 'Observação:', texto: 'Mensagem final:', recomendacao: 'Indicação do professor:', motivo: 'Por quê:'
};
const COR = { saibro: '#A8492A', tinta: '#1C1A17', texto: '#3F3A34', suave: '#5E574E' };

function criarDoc(d, pasta) {
  const reav = d.tipo === 'reavaliacao';
  const doc = DocumentApp.create('Diagnóstico · ' + d.aluno.nome + ' · ' + d.aluno.data);
  const body = doc.getBody();
  const A = DocumentApp.Attribute;
  const estiloTexto = {}; estiloTexto[A.FONT_FAMILY] = 'Figtree'; estiloTexto[A.FONT_SIZE] = 11; estiloTexto[A.FOREGROUND_COLOR] = COR.texto; estiloTexto[A.BOLD] = false;
  const par = (txt, rotulo) => {
    const p = body.appendParagraph(rotulo ? rotulo + ' ' + (txt || '') : (txt || ''));
    p.setAttributes(estiloTexto);
    if (rotulo) p.editAsText().setBold(0, rotulo.length - 1, true).setForegroundColor(0, rotulo.length - 1, COR.tinta);
    return p;
  };
  const item = txt => { const li = body.appendListItem(txt || ''); li.setGlyphType(DocumentApp.GlyphType.BULLET); li.setAttributes(estiloTexto); return li; };
  const titulo = (txt, nivel) => {
    const p = body.appendParagraph(txt);
    p.setHeading(nivel === 2 ? DocumentApp.ParagraphHeading.HEADING2 : DocumentApp.ParagraphHeading.HEADING1);
    const s = {}; s[A.FONT_FAMILY] = 'Barlow Condensed'; s[A.BOLD] = true; s[A.FONT_SIZE] = nivel === 2 ? 13 : 17; s[A.FOREGROUND_COLOR] = nivel === 2 ? COR.tinta : COR.saibro;
    p.setAttributes(s);
    return p;
  };

  const t = body.appendParagraph('Diagnóstico · ' + d.aluno.nome);
  t.setHeading(DocumentApp.ParagraphHeading.TITLE);
  const st = {}; st[A.FONT_FAMILY] = 'Barlow Condensed'; st[A.BOLD] = true; st[A.FONT_SIZE] = 26; st[A.FOREGROUND_COLOR] = COR.tinta; t.setAttributes(st);
  par((reav ? 'Reavaliação' : 'Aula experimental') + ' · ' + d.aluno.data + ' · Prof. Paulo Santana');
  const nota = par('Como editar: mude só o texto. Mantenha os títulos e os rótulos em negrito (como "O que eu vi:") para o PDF sair certo. Depois, volte à área do professor e toque em "Abrir o PDF".');
  const sn = {}; sn[A.ITALIC] = true; sn[A.FONT_SIZE] = 9; sn[A.FOREGROUND_COLOR] = COR.suave; nota.setAttributes(sn);

  titulo(SECOES.resumo[0]); par(d.resumo);
  titulo(SECOES.classe[0]); par(d.classe.sugerida + ' classe · média ' + String(d.classe.media).replace('.', ',') + ' · ITN ' + String(d.classe.itn).replace('.', ',') + ' (este parágrafo não muda o PDF)').setAttributes(sn);
  par(d.classe.justificativa);
  titulo(reav ? SECOES.fortes[1] : SECOES.fortes[0]); d.fortes.forEach(item);
  titulo(reav ? SECOES.melhorar[1] : SECOES.melhorar[0]); d.melhorar.forEach(item);
  titulo(SECOES.golpes[0]);
  d.golpes.forEach(g => { titulo(g.golpe, 2); par(g.vi, ROTULOS.vi); par(g.corrigir, ROTULOS.corrigir); par(g.exercicio, ROTULOS.exercicio); });
  if (d.saque) {
    titulo(SECOES.saque[0]);
    d.saque.quadros.forEach(q => par(q.obs, q.fase + ':'));
    par(d.saque.bom, ROTULOS.bom); par(d.saque.prioridade, ROTULOS.prioridade);
  }
  titulo(SECOES.plano[0]); par(d.planoTitulo, ROTULOS.titulo);
  d.plano.forEach(f => { titulo(f.semanas + ' · ' + f.titulo + (f.reavaliacao ? ' · com reavaliação' : ''), 2); f.itens.forEach(i => item(i.foco + ': ' + i.exercicio)); });
  titulo(SECOES.casa[0]); d.casa.forEach(item);
  titulo(SECOES.raquete[0]); par(d.equipamento.raquete, ROTULOS.raquete); par(d.equipamento.obs, ROTULOS.obs);
  titulo(SECOES.proximo[0]); par(d.proximo.texto, ROTULOS.texto); par(d.proximo.recomendacao, ROTULOS.recomendacao); par(d.proximo.motivo, ROTULOS.motivo);

  if (body.getNumChildren() > 1 && body.getChild(0).getType() === DocumentApp.ElementType.PARAGRAPH && !body.getChild(0).asParagraph().getText()) body.removeChild(body.getChild(0));
  doc.saveAndClose();
  const arquivo = DriveApp.getFileById(doc.getId());
  arquivo.moveTo(pasta);
  return { id: doc.getId(), url: doc.getUrl(), versao: arquivo.getLastUpdated().getTime() };
}

function aplicarEdicoesDoDoc(original, docId) {
  const d = JSON.parse(JSON.stringify(original));
  const body = DocumentApp.openById(docId).getBody();
  const H1 = DocumentApp.ParagraphHeading.HEADING1, H2 = DocumentApp.ParagraphHeading.HEADING2;
  const norm = s => String(s || '').trim().toLowerCase();
  const secaoDe = txt => { const n = norm(txt); for (const k in SECOES) if (SECOES[k].some(x => norm(x) === n)) return k; return null; };
  const tira = (txt, rot) => norm(txt).indexOf(norm(rot)) === 0 ? String(txt).trim().slice(rot.length).trim() : null;
  const L = { resumo: [], classe: [], fortes: [], melhorar: [], casa: [], golpes: [], saqueQ: {}, plano: [] };
  let sec = null, sub = null, saqueBom = null, saquePrio = null, titPlano = null, raq = null, raqObs = null, pTexto = null, pRec = null, pMot = null;
  for (let i = 0; i < body.getNumChildren(); i++) {
    const el = body.getChild(i), tp = el.getType();
    if (tp !== DocumentApp.ElementType.PARAGRAPH && tp !== DocumentApp.ElementType.LIST_ITEM) continue;
    const p = tp === DocumentApp.ElementType.PARAGRAPH ? el.asParagraph() : el.asListItem();
    const txt = p.getText().trim(), h = p.getHeading();
    if (h === H1) { sec = secaoDe(txt); sub = null; continue; }
    if (h === H2) {
      if (sec === 'golpes') { sub = { golpe: txt }; L.golpes.push(sub); }
      else if (sec === 'plano') { const reav = / · com reavaliação$/i.test(txt); const pr = txt.replace(/ · com reavaliação$/i, '').split(' · '); sub = { semanas: pr[0].trim(), titulo: pr.slice(1).join(' · ').trim(), reavaliacao: reav, itens: [] }; L.plano.push(sub); }
      continue;
    }
    if (!txt || !sec) continue;
    let v;
    if (sec === 'resumo') L.resumo.push(txt);
    else if (sec === 'classe') { if (!/\(este parágrafo não muda o PDF\)$/.test(txt)) L.classe.push(txt); }
    else if (sec === 'fortes' || sec === 'melhorar' || sec === 'casa') L[sec].push(txt);
    else if (sec === 'golpes' && sub) {
      if ((v = tira(txt, ROTULOS.vi)) !== null) sub.vi = v;
      else if ((v = tira(txt, ROTULOS.corrigir)) !== null) sub.corrigir = v;
      else if ((v = tira(txt, ROTULOS.exercicio)) !== null) sub.exercicio = v;
    } else if (sec === 'saque') {
      if ((v = tira(txt, ROTULOS.bom)) !== null) saqueBom = v;
      else if ((v = tira(txt, ROTULOS.prioridade)) !== null) saquePrio = v;
      else FASES.forEach(f => { const w = tira(txt, f + ':'); if (w !== null) L.saqueQ[f] = w; });
    } else if (sec === 'plano') {
      if ((v = tira(txt, ROTULOS.titulo)) !== null) titPlano = v;
      else if (sub) { const k = txt.indexOf(':'); sub.itens.push(k > 0 ? { foco: txt.slice(0, k).trim(), exercicio: txt.slice(k + 1).trim() } : { foco: txt, exercicio: '' }); }
    } else if (sec === 'raquete') {
      if ((v = tira(txt, ROTULOS.raquete)) !== null) raq = v; else if ((v = tira(txt, ROTULOS.obs)) !== null) raqObs = v;
    } else if (sec === 'proximo') {
      if ((v = tira(txt, ROTULOS.texto)) !== null) pTexto = v;
      else if ((v = tira(txt, ROTULOS.recomendacao)) !== null) pRec = v;
      else if ((v = tira(txt, ROTULOS.motivo)) !== null) pMot = v;
    }
  }
  /* só substitui o que foi lido; uma seção apagada sem querer não some do PDF */
  if (L.resumo.length) d.resumo = L.resumo.join(' ');
  if (L.classe.length) d.classe.justificativa = L.classe.join(' ');
  ['fortes', 'melhorar', 'casa'].forEach(k => { if (L[k].length) d[k] = L[k]; });
  if (L.golpes.length) d.golpes = L.golpes.map(g => {
    const o = (original.golpes || []).filter(x => norm(x.golpe) === norm(g.golpe))[0] || {};
    const nome = GOLPES.filter(x => norm(x) === norm(g.golpe))[0] || g.golpe;
    const nota = o.nota || ((original.notas || []).filter(n => norm(n.golpe) === norm(nome))[0] || {}).nota || 0;
    return { golpe: nome, nota: nota, vi: g.vi !== undefined ? g.vi : o.vi || '', corrigir: g.corrigir !== undefined ? g.corrigir : o.corrigir || '', exercicio: g.exercicio !== undefined ? g.exercicio : o.exercicio || '' };
  });
  if (d.saque) {
    d.saque.quadros.forEach(q => { if (L.saqueQ[q.fase] !== undefined) q.obs = L.saqueQ[q.fase]; });
    if (saqueBom !== null) d.saque.bom = saqueBom;
    if (saquePrio !== null) d.saque.prioridade = saquePrio;
  }
  if (titPlano) d.planoTitulo = titPlano;
  if (L.plano.length) d.plano = L.plano;
  if (raq !== null) d.equipamento.raquete = raq;
  if (raqObs !== null) d.equipamento.obs = raqObs;
  if (pTexto !== null) d.proximo.texto = pTexto;
  if (pRec !== null) d.proximo.recomendacao = pRec;
  if (pMot !== null) d.proximo.motivo = pMot;
  return d;
}

/* =====================================================================
   PLANILHA E E-MAIL
   ===================================================================== */
function abaRegistro() {
  const aba = SpreadsheetApp.openById(prop('PLANILHA_ID')).getSheets()[0];
  const cab = aba.getRange(1, 1, 1, Math.max(1, aba.getLastColumn())).getValues()[0].map(String);
  /* acrescenta no fim as colunas que ainda não existirem */
  const faltam = CABECALHO.filter(c => cab.indexOf(c) < 0);
  if (faltam.length) { aba.getRange(1, cab.length + 1, 1, faltam.length).setValues([faltam]).setFontWeight('bold'); faltam.forEach(c => cab.push(c)); }
  return { aba: aba, cab: cab };
}
function registrarPlanilha(al, au, pasta, d) {
  const r = abaRegistro(), c = d.classe, a = d.aluno;
  const v = {
    'Data': au.data, 'Aluno': al.nome, 'Idade': a.idade ? Number(a.idade) || a.idade : '', 'Local': a.local, 'Tipo': au.tipo === 'reavaliacao' ? 'Reavaliação' : 'Aula experimental',
    'Objetivo': a.objetivo, 'Tempo de prática': a.tempo, 'Experiência em jogo': a.experiencia, 'Nível': a.nivel,
    'Classe anterior': c.anterior || '', 'Classe pelas notas': c.calculada || c.sugerida, 'Classe sugerida': c.sugerida, 'Classe confirmada': c.confirmada || '',
    'Média': c.media, 'ITN': c.itn, 'Itens avaliados': (d.notas || []).length,
    'Tem vídeo do saque': d.saque ? 'Sim' : 'Não', 'Indicação do professor': (d.proximo || {}).recomendacao || '',
    'Diagnóstico (Doc)': au.docUrl, 'Pasta do aluno': pasta.getUrl(), 'ID do aluno': al.id, 'ID da aula': au.id
  };
  GOLPES.forEach(g => { const n = (d.notas || []).filter(x => x.golpe === g)[0]; v['Nota · ' + g] = n ? n.nota : ''; });
  r.aba.appendRow(r.cab.map(k => v[k] === undefined || v[k] === null ? '' : v[k]));
}
function atualizarPlanilha(aulaId, nomeColuna, valor) {
  const r = abaRegistro();
  const colId = r.cab.indexOf('ID da aula') + 1, col = r.cab.indexOf(nomeColuna) + 1;
  if (!colId || !col || r.aba.getLastRow() < 2) return;
  const achou = r.aba.getRange(2, colId, r.aba.getLastRow() - 1, 1).createTextFinder(aulaId).matchEntireCell(true).findNext();
  if (achou) r.aba.getRange(achou.getRow(), col).setValue(valor);
}

function avisarPorEmail(al, d, docUrl, pastaUrl) {
  const para = prop('EMAIL_PROFESSOR') || Session.getEffectiveUser().getEmail();
  const reav = d.tipo === 'reavaliacao';
  const e = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = '<div style="font-family:Arial,sans-serif;color:#1C1A17;max-width:560px">' +
    '<p style="font-size:12px;letter-spacing:2px;color:#A8492A;font-weight:bold;margin:0">PS TENNIS TEAM · ' + (reav ? 'REAVALIAÇÃO' : 'AULA EXPERIMENTAL') + '</p>' +
    '<h2 style="margin:6px 0 4px">' + e(al.nome) + ' · ' + e(d.aluno.data) + '</h2>' +
    '<p style="margin:0 0 14px;color:#5E574E">Classe sugerida: <b style="color:#1C1A17">' + e(d.classe.sugerida) + '</b>' + (d.classe.anterior ? ' (antes: ' + e(d.classe.anterior) + ')' : '') + ' · média ' + e(String(d.classe.media).replace('.', ',')) + '</p>' +
    '<p style="line-height:1.55">' + e(d.resumo) + '</p>' +
    '<p style="line-height:1.55"><b>Próximos passos:</b> confirme a classe na área do professor e toque em "Abrir o PDF" para enviar ao aluno o relatório com a identidade visual.</p>' +
    '<p><a href="' + CFG.SITE + '" style="background:#1C1A17;color:#F4EEE6;padding:10px 18px;border-radius:999px;text-decoration:none;display:inline-block">Abrir a área do professor</a></p>' +
    '<p style="font-size:13px;color:#5E574E">Texto editável: <a href="' + docUrl + '">Google Doc</a> · Pasta do aluno: <a href="' + pastaUrl + '">Drive</a></p></div>';
  const opcoes = { to: para, subject: 'Diagnóstico · ' + al.nome + ' · ' + d.aluno.data, htmlBody: html, name: 'PS Tennis · Área do professor' };
  if (prop('EMAIL_COPIA')) opcoes.cc = prop('EMAIL_COPIA');
  MailApp.sendEmail(opcoes);
}

/* =====================================================================
   TREINOS POR TEMA: TEMA DA SEMANA E TREINO DE CADA ALUNO
   O ciclo tem 6 temas, um por semana, iguais para todos os alunos. O
   Paulo escolhe o tema da semana na página e o ciclo avança sozinho toda
   segunda-feira. O treino da semana do aluno junta o tema, o nível e o
   plano de treino da última avaliação, partindo do banco de exercícios
   publicado no site (professor/treinos-por-tema.json).
   ===================================================================== */
const TEMAS_NO_CICLO = 6;
const DIA = 864e5;
const SEMANA_RE = /^\d{4}-\d{2}-\d{2}$/;
const diaUTC = s => { const p = String(s).split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); };
const dataBRparaUTC = s => { const p = String(s).split('/').map(Number); return Date.UTC(p[2], p[1] - 1, p[0]); };
const segundaUTC = t => t - ((new Date(t).getUTCDay() + 6) % 7) * DIA;
/* a página manda a segunda-feira da semana (aaaa-mm-dd, no fuso do aparelho do Paulo) */
function checarSemana(s) {
  s = String(s || '');
  if (!SEMANA_RE.test(s) || isNaN(diaUTC(s)) || new Date(diaUTC(s)).getUTCDay() !== 1) throw publico('Semana inválida. Atualize a página.');
  return s;
}
function temaDaSemana(ciclo, semana) {
  if (!ciclo || !SEMANA_RE.test(String(ciclo.inicio || '')) || !(ciclo.tema >= 1 && ciclo.tema <= TEMAS_NO_CICLO)) return 0;
  const k = Math.round((diaUTC(semana) - diaUTC(ciclo.inicio)) / (7 * DIA));
  return (((ciclo.tema - 1 + k) % TEMAS_NO_CICLO) + TEMAS_NO_CICLO) % TEMAS_NO_CICLO + 1;
}

function definirTema(req) {
  const semana = checarSemana(req.semana), n = Number(req.tema);
  if (!(n >= 1 && n <= TEMAS_NO_CICLO)) throw publico('Tema inválido.');
  const ciclo = comTrava(() => {
    const idx = lerIndice();
    idx.ciclo = { inicio: semana, tema: n };
    salvarIndice(idx);
    return idx.ciclo;
  });
  return { ciclo: ciclo };
}

function lerBanco() {
  const cache = CacheService.getScriptCache();
  const salvo = cache.get('banco_treinos');
  if (salvo) return JSON.parse(salvo);
  let r;
  try { r = UrlFetchApp.fetch(CFG.BANCO + '?t=' + Date.now(), { muteHttpExceptions: true }); }
  catch (e) { throw publico('Não consegui ler o banco de exercícios no site. Tente de novo em alguns minutos.'); }
  if (r.getResponseCode() !== 200) throw publico('Não consegui ler o banco de exercícios no site. Tente de novo em alguns minutos.');
  const txt = r.getContentText();
  let banco;
  try { banco = JSON.parse(txt); } catch (e) { throw publico('O arquivo treinos-por-tema.json do site tem um erro de formatação.'); }
  if (!banco || !Array.isArray(banco.temas)) throw publico('O arquivo treinos-por-tema.json do site está incompleto.');
  try { cache.put('banco_treinos', txt, 600); } catch (e) {}
  return banco;
}

/* Nível do aluno para o banco (o banco tem Iniciante, Intermediário e Avançado) */
const NIVEL_POR_CLASSE = { '6ª': 'Iniciante', '5ª': 'Iniciante', '4ª': 'Intermediário', '3ª': 'Intermediário', '2ª': 'Intermediário', '1ª': 'Avançado' };
function nivelDoAluno(diag) {
  const c = diag.classe || {};
  if (c.confirmada && c.confirmada !== c.sugerida && NIVEL_POR_CLASSE[c.confirmada]) return NIVEL_POR_CLASSE[c.confirmada];
  return c.nivel || (diag.aluno && diag.aluno.nivel) || NIVEL_POR_CLASSE[c.confirmada || c.sugerida] || 'Iniciante';
}
const nivelNoBanco = n => /avan/i.test(n) ? 'Avançado' : /interm/i.test(n) ? 'Intermediário' : 'Iniciante';

/* Em que semana do plano o aluno está (a contagem começa na semana da avaliação) */
function semanaDoPlano(diag, semana) {
  const fases = (diag.plano || []).map(f => { const m = /(\d+)\D+(\d+)/.exec(f.semanas || ''); return { f: f, de: m ? +m[1] : 0, ate: m ? +m[2] : 0 }; }).filter(x => x.de && x.ate);
  if (!fases.length) return { semana: 0, fase: null, alemDoPlano: false };
  const desde = Math.round((diaUTC(semana) - segundaUTC(dataBRparaUTC(diag.aluno && diag.aluno.data))) / (7 * DIA));
  const n = fases[0].de - 1 + Math.max(1, isNaN(desde) ? 1 : desde);
  const atual = fases.filter(x => n >= x.de && n <= x.ate)[0];
  const ultima = fases[fases.length - 1];
  return { semana: n, fase: (atual || (n > ultima.ate ? ultima : fases[0])).f, alemDoPlano: n > ultima.ate };
}

function treinoSemana(req) {
  const semana = checarSemana(req.semana);
  const idx = lerIndice();
  const al = idx.alunos.filter(a => a.id === req.alunoId)[0];
  if (!al || !al.aulas.length) throw publico('Aluno não encontrado. Atualize a página.');
  const n = temaDaSemana(idx.ciclo, semana);
  if (!n) throw publico('Defina o tema da semana na tela inicial.');
  const ja = (al.treinos || []).filter(t => t.semana === semana && t.tema === n)[0];
  if (ja && !req.refazer) return { aluno: paraPagina(al) };
  /* economia: cada aluno tem um treino por semana; "Montar de novo" tem limite */
  const limite = Number(prop('REFAZER_TREINO') || CFG.REFAZER_TREINO_PADRAO);
  const refeitos = ja ? (ja.refeitos || 0) + 1 : 0;
  if (ja && refeitos > limite) throw publico('O treino de ' + String(al.nome).split(' ')[0] + ' já foi montado de novo ' + limite + (limite === 1 ? ' vez' : ' vezes') + ' esta semana. Para economizar o Claude, use o treino atual e ajuste na quadra.');

  const banco = lerBanco();
  const tema = banco.temas.filter(t => Number(t.n) === n)[0];
  if (!tema) throw publico('O tema ' + n + ' não está no banco de exercícios.');
  const au = al.aulas[al.aulas.length - 1];
  const diag = lerArquivoAula(au).diag;
  const nivel = nivelDoAluno(diag), nivelBanco = nivelNoBanco(nivel);
  const doNivel = (tema.niveis || {})[nivelBanco] || { objetivo: '', exercicios: [] };
  const plano = semanaDoPlano(diag, semana);
  const anteriores = (al.treinos || []).filter(t => t.semana !== semana).slice(-2);
  /* o script já escolhe os exercícios do banco que mais servem a este aluno:
     o Claude recebe só os melhores (texto menor, chamada mais barata) */
  const rank = rankearBanco(doNivel.exercicios || [], diag, plano, anteriores);
  const selecao = { objetivo: doNivel.objetivo, exercicios: rank.slice(0, CFG.EXERCICIOS_PARA_O_CLAUDE) };

  let ia = null, aviso = '';
  if (String(prop('MODO_TREINO')).toLowerCase() !== 'banco') {
    try { ia = escreverTreino({ al: al, diag: diag, nivel: nivel, nivelBanco: nivelBanco, tema: tema, doNivel: selecao, plano: plano, anteriores: anteriores }); }
    catch (e) { console.error('Treino com o Claude: ' + (e && e.message)); aviso = 'O Claude não respondeu agora (' + (e && e.publico ? e.message : 'erro') + '). Montei o treino direto pelo banco.'; }
  }
  const ids = (doNivel.exercicios || []).map(e => e.id);
  const base = ia || treinoPeloBanco(al, diag, tema, selecao, plano);
  const treino = {
    semana: semana, tema: n, temaTitulo: tema.titulo || '', nivel: nivel,
    semanaPlano: plano.semana, faseTitulo: plano.fase ? plano.fase.titulo || '' : '', alemDoPlano: plano.alemDoPlano,
    foco: base.foco || '', atencao: base.atencao || '',
    exercicios: (base.exercicios || []).filter(e => e && e.nome).slice(0, 4).map(e => ({
      idBanco: ids.indexOf(e.idBanco) >= 0 ? e.idBanco : '', nome: e.nome, como: e.como || '', dose: e.dose || '', porque: e.porque || ''
    })),
    semIA: !ia, refeitos: refeitos,
    geradoEm: Utilities.formatDate(new Date(), CFG.FUSO, 'dd/MM/yyyy'), avaliacao: au.id
  };
  if (!treino.exercicios.length) throw publico('Não encontrei exercícios no banco para este tema e nível.');

  const atualizado = comTrava(() => {
    const idx2 = lerIndice();
    const a = idx2.alunos.filter(x => x.id === al.id)[0];
    a.treinos = (a.treinos || []).filter(t => t.semana !== semana).concat([treino]).slice(-12);
    salvarIndice(idx2);
    return a;
  });
  return { aluno: paraPagina(atualizado), aviso: aviso };
}

/* Ordena o banco pelo que o aluno mais precisa: golpes com nota baixa, golpes
   citados na fase atual do plano e nos pontos a melhorar. Exercícios das duas
   últimas semanas descem na lista, para não repetir. */
const semAcento = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function rankearBanco(exercicios, diag, plano, anteriores) {
  const notas = {};
  (diag.notas || []).forEach(x => notas[x.golpe] = Number(x.nota) || 0);
  const fase = plano && plano.fase ? [plano.fase.titulo].concat((plano.fase.itens || []).map(i => i.foco + ' ' + i.exercicio)) : [];
  const texto = semAcento(fase.concat(diag.melhorar || []).concat((diag.golpes || []).map(g => g.golpe)).join(' '));
  const usados = {};
  (anteriores || []).forEach(t => (t.exercicios || []).forEach(e => { if (e.idBanco) usados[e.idBanco] = 1; usados[semAcento(e.nome)] = 1; }));
  return exercicios.map((e, i) => {
    let p = 0;
    (e.golpes || []).forEach(g => { if (notas[g]) p += Math.max(0, 10 - notas[g]); if (texto.indexOf(semAcento(g)) >= 0) p += 6; });
    if (usados[e.id] || usados[semAcento(e.nome)]) p -= 12;
    return { e: e, p: p, i: i };
  }).sort((a, b) => b.p - a.p || a.i - b.i).map(x => x.e);
}

/* Treino montado só pelo banco (sem gastar o Claude): os 3 primeiros do
   ranking, na ordem da aula (a ordem do banco vai da técnica ao jogo). */
function treinoPeloBanco(al, diag, tema, selecao, plano) {
  const todos = selecao.exercicios || [];
  const escolha = todos.slice(0, 3);
  const pos = {}; (tema.niveis ? Object.keys(tema.niveis).map(k => tema.niveis[k].exercicios || []) : []).forEach(l => l.forEach((e, i) => pos[e.id] = i));
  escolha.sort((a, b) => (pos[a.id] || 0) - (pos[b.id] || 0));
  const notas = {}; (diag.notas || []).forEach(x => notas[x.golpe] = Number(x.nota) || 0);
  const nome = String(al.nome).split(' ')[0];
  const fraco = (diag.golpes || []).slice().sort((a, b) => (notas[a.golpe] || 10) - (notas[b.golpe] || 10))[0];
  return {
    foco: 'Tema "' + tema.titulo + '": ' + (selecao.objetivo || '') + (plano.fase ? ' No plano de ' + nome + ', fase "' + plano.fase.titulo + '".' : ''),
    exercicios: escolha.map(e => {
      const g = (e.golpes || []).filter(x => notas[x]).sort((a, b) => notas[a] - notas[b])[0];
      return { idBanco: e.id, nome: e.nome, como: e.como, dose: e.dose, porque: g ? 'Trabalha ' + g.toLowerCase() + ' (nota ' + notas[g] + ' na última avaliação).' : '' };
    }),
    atencao: plano.alemDoPlano ? 'O plano de ' + nome + ' já terminou: está na hora da reavaliação.' : fraco && fraco.corrigir ? fraco.golpe + ': ' + fraco.corrigir : ''
  };
}

const SISTEMA_TREINO = [
  'Você monta o treino da semana de um aluno do professor de tênis Paulo Santana (PS Tennis Team, Belo Horizonte).',
  'Quem lê é o próprio Paulo, no celular, na quadra. Fale com ele ("você") e chame o aluno pelo primeiro nome. Português do Brasil, frases curtas e práticas, como anotação de treinador.',
  'O método do Paulo organiza as semanas por tema (situação de jogo): o tema da semana é o mesmo para todos os alunos e só muda a complexidade, conforme o nível. Os cinco pilares (técnica, movimentação, efeitos, tática e mentalidade) aparecem em toda semana.',
  'Regras:',
  '- Os exercícios precisam servir ao tema da semana e ao plano de treino do aluno ao mesmo tempo: escolha os que trabalham o tema usando os golpes e os pontos que o plano e a avaliação pedem.',
  '- Parta do banco de exercícios do nível do aluno. Use pelo menos 2 exercícios do banco, informando o id em idBanco. Você pode adaptar um exercício do banco (dose, simplificação, foco no golpe do plano), mantendo o id. Pode criar no máximo 1 exercício novo, quando o plano pedir algo que o banco não cobre; nesse caso, idBanco fica vazio.',
  '- Ajuste à idade e ao nível: para crianças, formato de desafio ou jogo; para principiantes, bola lançada na mão e mini quadra.',
  '- Se o objetivo do aluno for específico (por exemplo, preparação para torneios), o tema fica como pano de fundo e o plano individual tem prioridade.',
  '- Se o plano do aluno já passou da última semana, avise em "atencao" que está na hora da reavaliação.',
  '- Evite repetir os exercícios das últimas semanas, se houver alternativa no banco.',
  '- 3 ou 4 exercícios para uma aula de 1 hora, na ordem da aula: técnica, situação de jogo e pontos. Doses realistas (séries e repetições ou tempo).',
  '- Não invente fatos sobre o aluno que não estejam nos dados.',
  '- Nunca use travessão (—) nem meia-risca (–) como pontuação. Use vírgula, dois-pontos ou ponto. Não use emojis.'
].join('\n');

function contextoTreino(x) {
  const d = x.diag, a = d.aluno || {}, c = d.classe || {}, t = x.tema, L = [];
  const v = s => (s === undefined || s === null || s === '') ? 'não informado' : String(s);
  L.push('ALUNO: ' + v(x.al.nome).split(' ')[0] + ' | Idade: ' + v(a.idade || x.al.idade) + ' | Objetivo: ' + v(a.objetivo) + ' | Experiência em jogo: ' + v(a.experiencia));
  L.push('Classe atual: ' + v(c.confirmada || c.sugerida) + ' | Nível: ' + x.nivel + (x.nivel !== x.nivelBanco ? ' (use a base de ' + x.nivelBanco + ' do banco, simplificada)' : ''));
  L.push('Mão: ' + v(a.mao) + ' | Backhand: ' + v(a.backhand));
  L.push('');
  L.push('ÚLTIMA AVALIAÇÃO (' + v(a.data) + ', ' + (d.tipo === 'reavaliacao' ? 'reavaliação' : 'aula experimental') + ')');
  L.push('Notas (1 a 10): ' + (d.notas || []).map(n => n.golpe + ' ' + n.nota).join(', '));
  L.push('Pontos a melhorar: ' + (d.melhorar || []).join(' | '));
  (d.golpes || []).forEach(g => L.push('- ' + g.golpe + ': ' + v(g.vi) + ' Como corrigir: ' + v(g.corrigir)));
  if (d.saque && d.saque.prioridade) L.push('Prioridade do saque: ' + d.saque.prioridade);
  L.push('');
  L.push('PLANO DE TREINO: ' + v(d.planoTitulo));
  (d.plano || []).forEach(f => L.push('- ' + f.semanas + ' · ' + f.titulo + ': ' + (f.itens || []).map(i => i.foco + ' (' + i.exercicio + ')').join('; ')));
  L.push(x.plano.semana ? 'O aluno está na semana ' + x.plano.semana + ' do plano' + (x.plano.fase ? ', fase "' + x.plano.fase.titulo + '"' : '') + '.' + (x.plano.alemDoPlano ? ' O plano já terminou: está na hora da reavaliação.' : '') : 'Não deu para saber em que semana do plano o aluno está.');
  L.push('');
  L.push('TEMA DA SEMANA ' + t.n + ': ' + v(t.titulo) + ' (' + v(t.subtitulo) + '). Pergunta da semana: ' + v(t.pergunta));
  Object.keys(t.pilares || {}).forEach(k => L.push('- ' + k + ': ' + t.pilares[k]));
  if (t.nota) L.push('Nota do tema: ' + t.nota);
  L.push('');
  L.push('BANCO DE EXERCÍCIOS DO TEMA, NÍVEL ' + x.nivelBanco.toUpperCase() + ' (os mais indicados para este aluno, do mais para o menos indicado). Objetivo do nível: ' + v(x.doNivel.objetivo));
  (x.doNivel.exercicios || []).forEach(e => L.push('- [' + e.id + '] ' + e.nome + ': ' + e.como + ' Dose: ' + e.dose + '. Golpes: ' + (e.golpes || []).join(', ')));
  if (x.anteriores.length) {
    L.push('');
    L.push('EXERCÍCIOS DAS ÚLTIMAS SEMANAS: ' + x.anteriores.map(p => p.exercicios.map(e => e.nome).join(', ')).join(' | '));
  }
  return L.join('\n');
}

const ESQUEMA_TREINO = {
  type: 'object',
  properties: {
    foco: { type: 'string', description: '1 a 2 frases para o Paulo: como o tema da semana encontra o plano deste aluno e o que buscar nesta aula.' },
    exercicios: {
      type: 'array', description: '3 ou 4 exercícios, na ordem da aula.',
      items: {
        type: 'object',
        properties: {
          idBanco: { type: 'string', description: 'O id do exercício no banco (ex.: t1-ini-2), ou vazio se for um exercício novo.' },
          nome: { type: 'string', description: 'Nome curto do exercício.' },
          como: { type: 'string', description: 'Como fazer, 1 a 2 frases, já ajustado ao aluno.' },
          dose: { type: 'string', description: 'Séries e repetições ou tempo.' },
          porque: { type: 'string', description: '1 frase ligando o exercício ao plano ou a um ponto a melhorar do aluno.' }
        },
        required: ['idBanco', 'nome', 'como', 'dose', 'porque']
      }
    },
    atencao: { type: 'string', description: '1 frase: o detalhe técnico para observar e corrigir nesta semana, ou o aviso de reavaliação.' }
  },
  required: ['foco', 'exercicios', 'atencao']
};

function escreverTreino(x) {
  const r = chamarAnthropic({
    model: prop('MODELO_TREINO') || CFG.MODELO_TREINO_PADRAO, max_tokens: 1800, system: SISTEMA_TREINO, thinking: { type: 'between_tools' },
    output_config: { effort: 'low', format: { type: 'json_schema', schema: esquemaFechado(ESQUEMA_TREINO) } },
    messages: [{ role: 'user', content: contextoTreino(x) + '\n\nMonte o treino da semana deste aluno, no formato JSON pedido.' }]
  });
  console.log('Claude · treino da semana · tokens de saída: ' + ((r.usage || {}).output_tokens || 0));
  return lerJson(r);
}

/* =====================================================================
   ARMAZENAMENTO NO DRIVE
   ===================================================================== */
function pastaRaiz() {
  try { return DriveApp.getFolderById(prop('PASTA_ID')); }
  catch (e) { throw publico('O Apps Script ainda não foi configurado. Rode a função "configurar" no editor.'); }
}
function arquivoIndice() {
  try { return DriveApp.getFileById(prop('INDICE_ID')); }
  catch (e) { throw publico('O Apps Script ainda não foi configurado. Rode a função "configurar" no editor.'); }
}
const lerIndice = () => JSON.parse(arquivoIndice().getBlob().getDataAsString('UTF-8') || '{"alunos":[]}');
const salvarIndice = idx => arquivoIndice().setContent(JSON.stringify(idx));
const lerArquivoAula = au => JSON.parse(DriveApp.getFileById(au.arquivoId).getBlob().getDataAsString('UTF-8'));

function comTrava(fn) {
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(30000)) throw publico('O sistema está ocupado. Tente de novo em alguns segundos.');
  try { return fn(); } finally { trava.releaseLock(); }
}

/* Versões leves para a lista de alunos (sem imagens e sem o texto longo) */
function diagLeve(d) {
  const o = { tipo: d.tipo, aluno: d.aluno, resumo: d.resumo, notas: d.notas, classe: d.classe };
  if (d.resumoNota) o.resumoNota = d.resumoNota;
  if (d.anterior) o.anterior = d.anterior;
  return o;
}
function avLeve(av) {
  const o = JSON.parse(JSON.stringify(av || {}));
  delete o.quadros; delete o._video;
  return o;
}
const paraPagina = al => ({
  id: al.id, nome: al.nome, idade: al.idade, whatsapp: al.whatsapp, local: al.local, classe: al.classe,
  aulas: al.aulas.map(a => ({ id: a.id, tipo: a.tipo, data: a.data, docUrl: a.docUrl, pdfUrl: a.pdfUrl || '', diag: a.diag, av: a.av })),
  treinos: al.treinos || []
});

/* =====================================================================
   AUXILIARES
   ===================================================================== */
function prop(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
const modelo = () => prop('MODELO') || CFG.MODELO_PADRAO;
/* a classe calculada e as vizinhas (o Claude só pode ajustar uma classe) */
const classesVizinhas = c => { const i = CLASSES.indexOf(c); return CLASSES.filter((x, k) => Math.abs(k - i) <= 1); };
const novoId = () => Utilities.getUuid().replace(/-/g, '').slice(0, 10);
const lista = (v, max) => (Array.isArray(v) ? v : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, max);
function textoRaquete(av) {
  const partes = [av.raquete, av.peso && av.peso !== 'Não sei' ? av.peso : '', av.grip && av.grip !== 'Não sei' ? 'empunhadura ' + av.grip : '', av.corda].filter(Boolean);
  if (partes.length) return partes.join(', ');
  return av.semRaquete ? 'Usou raquete emprestada na aula' : 'Raquete não informada';
}
function publico(msg) { const e = new Error(msg); e.publico = true; return e; }
function sessao() { const e = new Error('sessao'); e.sessao = true; return e; }
