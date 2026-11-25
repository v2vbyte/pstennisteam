const assert = require('assert');
const { criarAmbiente } = require('./mock');
const ok = (c, m) => { assert.ok(c, m); console.log('  ok · ' + m); };

const PROPS = { ANTHROPIC_API_KEY: 'sk-test', GOOGLE_CLIENT_ID: 'client-123', EMAILS_AUTORIZADOS: 'pstennisteam@gmail.com, tamara@gmail.com', EMAIL_COPIA: 'tamara@gmail.com' };
const IMG = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg').toString('base64');
const golpes = (m) => Object.fromEntries(['Forehand', 'Backhand', 'Saque', 'Devolução', 'Voleio', 'Smash', 'Lob e passada', 'Movimentação', 'Consistência', 'Efeitos', 'Tática'].map(g => [g, { nota: m[g] || 0, obs: g === 'Forehand' ? 'contato atrasado' : '' }]));
const av1 = { nome: 'Ana Souza', idade: '29', whatsapp: '31999999999', local: 'Fama Tennis', objetivo: 'Jogar partidas', tempo: '1 a 3 anos', experiencia: 'Joga com amigos', classeAtual: 'Não tem', mao: 'Destro', backhand: 'Duas mãos', empunhadura: 'Eastern', nivel: 'Iniciante',
  golpes: golpes({ Forehand: 4, Backhand: 3, Saque: 3, Movimentação: 6, Consistência: 4 }), raquete: 'Babolat Pure', peso: '280 a 290 g', grip: 'L2', corda: '', semRaquete: false,
  fortes: 'se movimenta bem', melhorar: 'saque', gerais: 'nervosa nos pontos', internas: 'pagou com pix; cuidado com o ombro', quadros: [{ fase: 'Preparação', t: 1, img: IMG }, { fase: 'Lançamento', t: 2, img: IMG }], consent: true, consentResp: false, _video: true };
const cal1 = { media: 3.8, itn: 8, classe: '5ª', nivel: 'Iniciante', itens: 5 };

console.log('1. Sem configurar e sem login');
let E = criarAmbiente({ props: PROPS });
ok(E.post({ action: 'entrar' }).erro === 'sessao', 'sem token = sessao');
ok(E.post({ action: 'entrar', token: 'tok-ruim' }).erro === 'sessao', 'token inválido = sessao');
ok(E.post({ action: 'entrar', token: 'tok-outroapp' }).erro === 'sessao', 'token de outro app = sessao');
ok(/não tem acesso/.test(E.post({ action: 'entrar', token: 'tok-estranho' }).erro), 'conta não autorizada é recusada com mensagem');
ok(/configurar/.test(E.post({ action: 'entrar', token: 'tok-ok' }).erro), 'antes do configurar, avisa para rodar configurar');

console.log('2. configurar');
E.ctx.configurar();
ok(E.props.PASTA_ID && E.props.PLANILHA_ID && E.props.INDICE_ID, 'cria pasta, planilha e índice');
E.ctx.configurar();
ok(Object.values(E.folders).filter(f => f.name === 'PS Tennis · Alunos').length === 1, 'rodar de novo não duplica a pasta');
ok(E.log.logs.some(l => /Tudo certo/.test(l)), 'log confirma propriedades completas');

console.log('3. entrar');
let r = E.post({ action: 'entrar', token: 'tok-ok' });
ok(r.ok && r.email === 'pstennisteam@gmail.com' && r.alunos.length === 0, 'entra com lista vazia');

console.log('4. gerar (aula experimental com vídeo)');
r = E.post({ action: 'gerar', token: 'tok-ok', tipo: 'experimental', alunoId: null, avaliacao: av1, calibragem: cal1 });
ok(r.ok, 'gerar ok: ' + (r.erro || ''));
const al = r.aluno, au = al.aulas[0];
ok(al.nome === 'Ana Souza' && al.aulas.length === 1 && au.docUrl.includes('docs.google.com'), 'aluno e aula voltam no formato da página');
ok(au.diag.classe.sugerida === '5ª' && au.diag.classe.confirmada === '' && au.diag.classe.anterior === '', 'classe sugerida, sem confirmação');
ok(!JSON.stringify(au).includes('fake-jpeg'.slice(0, 4) === 'fake' ? Buffer.from('fake-jpeg').toString('base64') : 'x'), 'lista de alunos não carrega as imagens');
ok(au.av && au.av.nome === 'Ana Souza' && !au.av.quadros, 'av leve guardado para a reavaliação');
const [c1, c2] = E.log.claude;
ok(E.log.claude.length === 2 && c1.headers['x-api-key'] === 'sk-test' && c1.headers['anthropic-version'] === '2023-06-01', 'duas chamadas em paralelo com os cabeçalhos certos');
ok(c1.corpo.model === 'claude-sonnet-5-5' && !c1.corpo.tool_choice && c1.corpo.output_config.format.type === 'json_schema' && c2.corpo.output_config.format.schema.properties.plano, 'modelo e saída estruturada (sem tool_choice)');
ok(JSON.stringify(c1.corpo.messages).includes('"type":"image"') && !JSON.stringify(c2.corpo.messages).includes('"type":"image"'), 'imagens do saque só na chamada do diagnóstico');
ok(!JSON.stringify(E.log.claude).includes('pagou com pix'), 'notas internas NÃO vão para o Claude');
ok(JSON.stringify(c1.corpo.messages).includes('contato atrasado'), 'observação por golpe vai para o Claude');

console.log('5. ler (diagnóstico completo para o PDF)');
r = E.post({ action: 'ler', token: 'tok-ok', alunoId: al.id, aulaId: au.id });
const d = r.diagnostico;
ok(r.ok && d.fortes.length === 3 && d.melhorar.length === 3 && d.plano.length === 3 && d.casa.length === 2, 'tem todas as seções do relatório');
ok(d.golpes.length === 2 && d.golpes[0].nota === 4, 'descarta golpe inventado e põe a nota do professor');
ok(d.saque && d.saque.quadros.length === 2 && d.saque.quadros[0].img === IMG && d.saque.quadros[1].obs === 'Bola atrás da cabeça.', 'saque com imagens e observações por fase');
ok(!/[—–]/.test(JSON.stringify(d)), 'nenhum travessão no texto final');
ok(d.resumo.startsWith('Você tem uma base boa, se movimenta'), 'travessão vira vírgula: ' + d.resumo.slice(0, 50));
ok(d.equipamento.raquete === 'Babolat Pure, 280 a 290 g, empunhadura L2', 'raquete montada da ficha');
ok(d.plano[1].reavaliacao === true, 'fase 2 marcada com reavaliação');

console.log('6. planilha, e-mail e Drive');
const cab = E.log.sheet.rows[0], col = n => cab.indexOf(n), linha1 = () => E.log.sheet.rows[1];
ok(E.log.sheetRows.length === 1 && linha1()[col('Aluno')] === 'Ana Souza' && linha1()[col('Classe sugerida')] === '5ª', 'linha na planilha');
ok(linha1()[col('Nota · Forehand')] === 4 && linha1()[col('Nota · Smash')] === '' && linha1()[col('Idade')] === 29 && linha1()[col('Local')] === 'Fama Tennis', 'notas por golpe, idade e local em colunas próprias');
ok(linha1()[col('Tem vídeo do saque')] === 'Sim' && linha1()[col('Indicação do professor')] === 'Aula individual, 1 vez por semana' && linha1().length === cab.length, 'vídeo, indicação e linha do tamanho do cabeçalho');
ok(E.log.mails.length === 1 && E.log.mails[0].cc === 'tamara@gmail.com' && /Ana Souza/.test(E.log.mails[0].subject), 'e-mail com cópia');
ok(!/pix/.test(E.log.mails[0].htmlBody), 'e-mail sem notas internas');
const pastaAluno = Object.values(E.folders).find(f => f.name === 'Ana Souza');
ok(pastaAluno && Object.values(E.files).filter(f => f.parent === pastaAluno.id).length === 2, 'pasta do aluno com o Doc e o arquivo da aula');

console.log('7. confirmar classe');
r = E.post({ action: 'confirmarClasse', token: 'tok-ok', alunoId: al.id, aulaId: au.id, classe: '4ª' });
ok(r.ok, 'confirmar ok');
r = E.post({ action: 'entrar', token: 'tok-ok' });
ok(r.alunos[0].classe === '4ª' && r.alunos[0].aulas[0].diag.classe.confirmada === '4ª' && r.alunos[0].aulas[0].diag.resumoNota, 'classe confirmada e nota de ajuste');
ok(E.post({ action: 'ler', token: 'tok-ok', alunoId: al.id, aulaId: au.id }).diagnostico.classe.confirmada === '4ª', 'arquivo completo também atualizado');
ok(linha1()[col('Classe confirmada')] === '4ª', 'planilha atualizada');
E.log.sheet.rows.forEach(r => r.push('coluna do Paulo'));
E.log.sheet.rows[0][E.log.sheet.rows[0].length - 1] = 'Observação manual';
ok(/inválida/.test(E.post({ action: 'confirmarClasse', token: 'tok-ok', alunoId: al.id, aulaId: au.id, classe: '9ª' }).erro), 'classe inválida recusada');

console.log('8. edição no Google Doc volta para o PDF');
const docId = Object.values(E.docs).length && Object.keys(E.docs)[0];
const filhos = E.docs[docId].body.filhos;
ok(filhos[0].heading === 'TITLE', 'Doc começa pelo título (parágrafo vazio removido)');
const txts = filhos.map(f => f.texto);
ok(txts.includes('Golpes') && txts.includes('O que eu vi: Contato perto do corpo.') && txts.includes('Semanas 5 a 8 · Consistência · com reavaliação'), 'Doc com seções e rótulos');
E.editarDoc(docId, fs => {
  const i = fs.findIndex(f => f.texto === 'Resumo'); fs[i + 1].texto = 'Resumo reescrito pelo Paulo.';
  fs.find(f => f.texto === 'O que eu vi: Contato perto do corpo.').texto = 'O que eu vi: Contato atrasado, editado.';
  const novo = E.docs[docId].body.appendListItem('Quarto ponto forte novo.'); fs.pop(); const k = fs.findIndex(f => f.texto === 'Pontos fortes'); fs.splice(k + 2, 0, novo);
  fs.find(f => f.texto.startsWith('Indicação do professor:')).texto = 'Indicação do professor: Aula em dupla, 1 vez por semana';
  const p = fs.find(f => f.texto.startsWith('Semanas 9 a 12')); p.texto = 'Semanas 9 a 12 · Jogo de pontos';
});
const d2 = E.post({ action: 'ler', token: 'tok-ok', alunoId: al.id, aulaId: au.id }).diagnostico;
ok(d2.resumo === 'Resumo reescrito pelo Paulo.', 'resumo editado');
ok(d2.golpes[0].vi === 'Contato atrasado, editado.' && d2.golpes[0].nota === 4, 'golpe editado mantendo a nota');
ok(d2.fortes.length === 4 && d2.fortes[1] === 'Quarto ponto forte novo.', 'item novo na lista');
ok(d2.proximo.recomendacao === 'Aula em dupla, 1 vez por semana', 'indicação editada');
ok(d2.plano[2].titulo === 'Jogo de pontos' && d2.plano[1].reavaliacao === true && d2.plano[2].itens.length === 3, 'plano editado');
ok(d2.saque.quadros[0].img === IMG && d2.classe.confirmada === '4ª', 'imagens e classe preservadas');
ok(E.post({ action: 'entrar', token: 'tok-ok' }).alunos[0].aulas[0].diag.resumo === 'Resumo reescrito pelo Paulo.', 'lista também mostra o resumo editado');

console.log('9. reavaliação');
const av2 = Object.assign(JSON.parse(JSON.stringify(av1)), { quadros: [], _video: false, golpes: golpes({ Forehand: 6, Backhand: 5, Saque: 5, Movimentação: 6, Consistência: 6 }) });
E.log.claude.length = 0;
r = E.post({ action: 'gerar', token: 'tok-ok', tipo: 'reavaliacao', alunoId: al.id, avaliacao: av2, calibragem: { media: 5.6, itn: 6.5, classe: '3ª', nivel: 'Intermediário', itens: 5 } });
ok(r.ok && r.aluno.aulas.length === 2, 'reavaliação vira a segunda aula do mesmo aluno: ' + (r.erro || ''));
const u2 = r.aluno.aulas[1];
ok(u2.diag.classe.anterior === '4ª' && u2.diag.anterior && u2.diag.anterior.classe === '4ª' && u2.diag.anterior.notas.length === 5, 'classe e notas anteriores vêm da aula confirmada');
ok(JSON.stringify(E.log.claude[0].corpo.messages).includes('AVALIAÇÃO ANTERIOR') && JSON.stringify(E.log.claude[0].corpo.messages).includes('Resumo reescrito pelo Paulo.'), 'Claude recebe a avaliação anterior já editada');
const d3 = E.post({ action: 'ler', token: 'tok-ok', alunoId: al.id, aulaId: u2.id }).diagnostico;
ok(d3.saque === null && d3.plano.length === 2 && d3.plano[0].semanas === 'Semanas 9 a 12', 'sem vídeo, sem saque; intervalo com meia-risca vira "a"');
ok(Object.values(E.folders).filter(f => f.name === 'Ana Souza').length === 1, 'não cria pasta duplicada');
ok(E.log.sheet.rows.length === 3 && E.log.sheet.rows[2][col('Tipo')] === 'Reavaliação' && E.log.sheet.rows[2][col('Classe anterior')] === '4ª', 'reavaliação vira nova linha, mesmo com coluna extra criada pelo Paulo');

console.log('9b. observações pesam na classe');
let E3 = criarAmbiente({ props: PROPS, classeClaude: (op, msg) => msg.includes('ganhou dois torneios internos') ? op[op.length - 1] : op[1] }); E3.ctx.configurar();
const av3 = Object.assign({}, av1, { gerais: 'ganhou dois torneios internos, muito sólido sob pressão' });
r = E3.post({ action: 'gerar', token: 'tok-ok', tipo: 'experimental', avaliacao: av3, calibragem: cal1 });
ok(JSON.stringify(E3.log.opcoesClasse) === JSON.stringify(['6ª', '5ª', '4ª']), 'Claude só pode escolher a classe calculada ou as vizinhas');
ok(r.aluno.aulas[0].diag.classe.sugerida === '4ª' && r.aluno.aulas[0].diag.classe.calculada === '5ª', 'observação sobe a classe sugerida em uma (5ª calculada, 4ª sugerida)');
ok(JSON.stringify(E3.log.claude[0].corpo.messages).includes('ganhou dois torneios internos'), 'campo "jogo e competição" chega ao Claude');
let E4 = criarAmbiente({ props: PROPS, classeClaude: () => '1ª' }); E4.ctx.configurar();
r = E4.post({ action: 'gerar', token: 'tok-ok', tipo: 'experimental', avaliacao: av1, calibragem: cal1 });
ok(r.aluno.aulas[0].diag.classe.sugerida === '5ª', 'resposta fora do limite é ignorada e volta para a classe calculada');
E4 = criarAmbiente({ props: PROPS }); E4.ctx.configurar();
r = E4.post({ action: 'gerar', token: 'tok-ok', tipo: 'experimental', avaliacao: av1, calibragem: { media: 1.5, itn: 10, classe: '6ª', nivel: 'Principiante' } });
ok(JSON.stringify(E4.log.opcoesClasse) === JSON.stringify(['6ª', '5ª']), 'na 6ª calculada, só 6ª ou 5ª');

let E5 = criarAmbiente({ props: PROPS, caixaAlta: true }); E5.ctx.configurar();
r = E5.post({ action: 'gerar', token: 'tok-ok', tipo: 'experimental', avaliacao: av1, calibragem: cal1 });
const d5 = E5.post({ action: 'ler', token: 'tok-ok', alunoId: r.aluno.id, aulaId: r.aluno.aulas[0].id }).diagnostico;
ok(r.ok && d5.golpes[0].golpe === 'Forehand' && d5.classe.sugerida === '5ª', 'valores fixos com maiúsculas trocadas são corrigidos');

console.log('10. erros do Claude');
let E2 = criarAmbiente({ props: PROPS, falhaClaude: 401 }); E2.ctx.configurar();
ok(/chave do Claude foi recusada/.test(E2.post({ action: 'gerar', token: 'tok-ok', tipo: 'experimental', avaliacao: av1, calibragem: cal1 }).erro), '401 explica a chave');
E2 = criarAmbiente({ props: PROPS, falhaClaude: 529 }); E2.ctx.configurar();
r = E2.post({ action: 'gerar', token: 'tok-ok', tipo: 'experimental', avaliacao: av1, calibragem: cal1 });
ok(/sobrecarregado/.test(r.erro) && E2.log.claude.length === 4, 'sobrecarga tenta de novo uma vez e explica');
ok(E2.post({ action: 'entrar', token: 'tok-ok' }).alunos.length === 0, 'falha no Claude não cria aluno pela metade');
ok(/autorização/.test(E.post({ action: 'gerar', token: 'tok-ok', tipo: 'experimental', avaliacao: Object.assign({}, av1, { consent: false }), calibragem: cal1 }).erro), 'sem autorização, não gera');
console.log('\nTodos os testes passaram.');
