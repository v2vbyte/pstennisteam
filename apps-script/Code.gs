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
 *
 * Propriedades do script (Configurações do projeto > Propriedades do script):
 *   ANTHROPIC_API_KEY   chave da API do Claude (obrigatória)
 *   GOOGLE_CLIENT_ID    ID do cliente OAuth do Google Cloud (obrigatória)
 *   EMAILS_AUTORIZADOS  e-mails que podem entrar, separados por vírgula (obrigatória)
 *   EMAIL_COPIA         e-mail que recebe cópia dos avisos (opcional)
 *   MODELO              modelo do Claude (opcional, padrão claude-sonnet-5-5)
 * A função configurar() cria a pasta, a planilha e o índice e grava
 * PASTA_ID, PLANILHA_ID e INDICE_ID sozinha.
 */

const CFG = {
  PASTA: 'PS Tennis · Alunos',
  PLANILHA: 'PS Tennis · Registro de aulas',
  INDICE: 'indice-alunos.json',
  MODELO_PADRAO: 'claude-sonnet-5-5',
  SITE: 'https://www.pstennisteam.com/professor/',
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
  .concat(['Tem vídeo do saque', 'Indicação do professor', 'Diagnóstico (Doc)', 'Pasta do aluno', 'ID do aluno', 'ID da aula']);

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
  entrar: (req, email) => ({ email: email, alunos: lerIndice().alunos.map(paraPagina) }),
  gerar: gerar,
  confirmarClasse: confirmarClasse,
  ler: ler
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
  'Regras:',
  '- Baseie-se só nas notas, nas observações do professor e nos quadros do saque. Não invente fatos que não estejam na ficha (torneios, lesões, tempo de prática, resultados).',
  '- Quando um item não tiver observação, apoie-se na nota e fale com cuidado, sem detalhes que você não viu.',
  '- Frases curtas e concretas. Nada de elogio vazio nem frases genéricas de autoajuda.',
  '- Nunca use travessão (—) nem meia-risca (–) como pontuação. Use vírgula, dois-pontos ou ponto. Não use emojis.',
  '- Não fale de preços.',
  '- Exercícios realistas para uma aula de tênis, com séries e repetições ou tempo.',
  '- As notas vão de 1 a 10. A classe segue o ITN da ITF (6ª classe = iniciante, 1ª = mais avançada).',
  '- A média ponderada das notas dá a classe calculada, que é o ponto de partida. Use as observações do professor (por golpe, pontos fortes, pontos a melhorar, jogo e competição) para confirmar essa classe ou ajustá-la em no máximo uma classe para cima ou para baixo. Ajuste só quando as observações mostrarem algo que as notas não captam (por exemplo, experiência em partidas, comportamento sob pressão, consistência muito acima ou abaixo das notas). Na justificativa, diga se manteve ou ajustou e por quê.'
].join('\n');

function escreverComClaude(av, cal, tipo, antDiag, antClasse, quadros) {
  const contexto = montarContexto(av, cal, tipo, antDiag, antClasse, quadros);
  const reav = tipo === 'reavaliacao';
  const conteudo1 = [{ type: 'text', text: contexto }];
  quadros.forEach((q, i) => {
    const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(q.img || '');
    if (m) { conteudo1.push({ type: 'text', text: 'Quadro ' + (i + 1) + ' do saque: ' + q.fase }); conteudo1.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }); }
  });
  conteudo1.push({ type: 'text', text: 'Escreva agora a parte do diagnóstico com a ferramenta "diagnostico".' + (quadros.length ? ' Analise os quadros do saque.' : ' Não há vídeo do saque nesta aula: não preencha "saque".') });

  const p1 = {
    model: modelo(), max_tokens: 4000, system: SISTEMA,
    tools: [{ name: 'diagnostico', description: 'Registra a parte de diagnóstico do relatório.', input_schema: ESQUEMA_DIAGNOSTICO(reav, classesVizinhas(cal.classe)) }],
    tool_choice: { type: 'tool', name: 'diagnostico' },
    messages: [{ role: 'user', content: conteudo1 }]
  };
  const p2 = {
    model: modelo(), max_tokens: 3000, system: SISTEMA,
    tools: [{ name: 'plano', description: 'Registra o plano de treino e o próximo passo do relatório.', input_schema: ESQUEMA_PLANO(reav) }],
    tool_choice: { type: 'tool', name: 'plano' },
    messages: [{ role: 'user', content: contexto + '\n\n' + (reav
      ? 'Monte o PRÓXIMO CICLO de 8 semanas, com 2 fases de 4 semanas e 3 itens cada. Continue a numeração das semanas a partir do plano anterior (se a reavaliação foi ao fim da semana 8, comece na semana 9). Marque a última fase com reavaliacao = true. Ataque primeiro o "Foco do próximo ciclo" e as notas mais baixas.'
      : 'Monte um plano de 12 semanas, com 3 fases de 4 semanas (Semanas 1 a 4, 5 a 8, 9 a 12) e 3 itens cada. A primeira fase ataca os pontos a melhorar e as notas mais baixas; a última leva para o jogo. Marque a fase 2 com reavaliacao = true (reavaliação ao fim da semana 8).') +
      ' Considere 1 aula por semana. Na recomendação, use uma das modalidades: aula individual, em dupla ou em grupo (4 pessoas), 1 vez por semana. Use a ferramenta "plano".' }]
  };
  const r = chamarAnthropicVarios([p1, p2]);
  return { diagnostico: entradaFerramenta(r[0], 'diagnostico'), plano: entradaFerramenta(r[1], 'plano') };
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
    resumo: { type: 'string', description: reav ? '3 a 4 frases: o que mudou desde a última avaliação, a classe e o rumo do próximo ciclo.' : '3 a 4 frases: a base do aluno, o que mais segura o jogo hoje e a meta das próximas 12 semanas.' },
    justificativa: { type: 'string', description: '2 a 4 frases explicando a classe sugerida: a média e a faixa, como o jogo se encaixa na descrição do nível ITN, o que as observações do professor mostram e, se houve ajuste em relação à classe calculada, o motivo.' },
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

function entradaFerramenta(resp, nome) {
  const b = (resp.content || []).filter(x => x.type === 'tool_use' && x.name === nome)[0];
  if (!b || !b.input) throw publico('O Claude não devolveu o texto completo. Toque em "Tentar de novo".');
  return limparTravessoes(b.input);
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
  return { diagnostico: arq.diag };
}

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
  const nota = par('Como editar: mude só o texto. Mantenha os títulos e os rótulos em negrito (como "O que eu vi:") para o PDF sair certo. Depois, volte à área do professor e toque em "Ver e salvar o PDF".');
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
    '<p style="line-height:1.55"><b>Próximos passos:</b> confirme a classe na área do professor e toque em "Ver e salvar o PDF" para enviar ao aluno o relatório com a identidade visual.</p>' +
    '<p><a href="' + CFG.SITE + '" style="background:#1C1A17;color:#F4EEE6;padding:10px 18px;border-radius:999px;text-decoration:none;display:inline-block">Abrir a área do professor</a></p>' +
    '<p style="font-size:13px;color:#5E574E">Texto editável: <a href="' + docUrl + '">Google Doc</a> · Pasta do aluno: <a href="' + pastaUrl + '">Drive</a></p></div>';
  const opcoes = { to: para, subject: 'Diagnóstico · ' + al.nome + ' · ' + d.aluno.data, htmlBody: html, name: 'PS Tennis · Área do professor' };
  if (prop('EMAIL_COPIA')) opcoes.cc = prop('EMAIL_COPIA');
  MailApp.sendEmail(opcoes);
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
  aulas: al.aulas.map(a => ({ id: a.id, tipo: a.tipo, data: a.data, docUrl: a.docUrl, diag: a.diag, av: a.av }))
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
