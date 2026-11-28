// Simulação mínima dos serviços do Google Apps Script para testar Code.gs em Node
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');

function criarAmbiente(opts = {}) {
  const log = { mails: [], claude: [], sheetRows: [], logs: [] };
  let seq = 0, relogio = Date.now();
  const novo = p => p + (++seq);
  const agora = () => (relogio += 1000);
  const files = {}, folders = {}, docs = {}, sheets = {};

  class MFile {
    constructor(name, content, mime, parent) { this.id = novo('f'); this.name = name; this.content = content; this.mime = mime; this.parent = parent; this.updated = agora(); files[this.id] = this; }
    getId() { return this.id; } getName() { return this.name; }
    getBlob() { const c = this.content; return { getDataAsString: () => c }; }
    setContent(c) { this.content = c; this.updated = agora(); return this; }
    getLastUpdated() { return new Date(this.updated); }
    moveTo(f) { this.parent = f.id; return this; }
    setTrashed(t) { this.trashed = t; return this; }
    getUrl() { return 'https://drive.google.com/file/d/' + this.id; }
  }
  class MFolder {
    constructor(name, parent) { this.id = novo('d'); this.name = name; this.parent = parent; folders[this.id] = this; }
    getId() { return this.id; } getName() { return this.name; }
    getUrl() { return 'https://drive.google.com/drive/folders/' + this.id; }
    createFolder(n) { return new MFolder(n, this.id); }
    createFile(n, c, m) { if (n && typeof n === 'object' && n.__blob) return new MFile(n.name, n.bytes, n.mime, this.id); return new MFile(n, c, m, this.id); }
  }
  const DriveApp = {
    getFolderById(id) { if (!folders[id]) throw new Error('pasta inexistente ' + id); return folders[id]; },
    getFileById(id) { if (!files[id]) throw new Error('arquivo inexistente ' + id); return files[id]; },
    getFoldersByName(n) { const l = Object.values(folders).filter(f => f.name === n); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; },
    createFolder(n) { return new MFolder(n, 'root'); }
  };

  // ---- DocumentApp ----
  const ParagraphHeading = { TITLE: 'TITLE', HEADING1: 'H1', HEADING2: 'H2', NORMAL: 'NORMAL' };
  const ElementType = { PARAGRAPH: 'PARAGRAPH', LIST_ITEM: 'LIST_ITEM' };
  function elemento(tipo, texto) {
    const el = {
      tipo, texto, heading: ParagraphHeading.NORMAL, attrs: {},
      getType: () => el.tipo, getText: () => el.texto, setText: t => { el.texto = t; return el; },
      setHeading: h => { el.heading = h; return el; }, getHeading: () => el.heading,
      setAttributes: a => { Object.assign(el.attrs, a); return el; }, setGlyphType: () => el,
      editAsText: () => { const t = { setBold: (a, b) => { if (b >= el.texto.length) throw new Error('setBold fora do texto'); return t; }, setForegroundColor: (a, b) => t }; return t; },
      asParagraph: () => { if (el.tipo !== 'PARAGRAPH') throw new Error('não é parágrafo'); return el; },
      asListItem: () => { if (el.tipo !== 'LIST_ITEM') throw new Error('não é item'); return el; }
    };
    return el;
  }
  function corpo() {
    const filhos = [elemento('PARAGRAPH', '')];
    return {
      filhos,
      appendParagraph: t => { const e = elemento('PARAGRAPH', t); filhos.push(e); return e; },
      appendListItem: t => { const e = elemento('LIST_ITEM', t); filhos.push(e); return e; },
      getNumChildren: () => filhos.length, getChild: i => filhos[i],
      removeChild: e => { if (filhos.length < 2) throw new Error('não pode remover o último'); filhos.splice(filhos.indexOf(e), 1); }
    };
  }
  const DocumentApp = {
    ParagraphHeading, ElementType, GlyphType: { BULLET: 'BULLET' },
    Attribute: { FONT_FAMILY: 'FONT_FAMILY', FONT_SIZE: 'FONT_SIZE', FOREGROUND_COLOR: 'FOREGROUND_COLOR', BOLD: 'BOLD', ITALIC: 'ITALIC' },
    create(nome) {
      const f = new MFile(nome, '', 'application/vnd.google-apps.document', 'root');
      const d = { body: corpo(), getId: () => f.id, getUrl: () => 'https://docs.google.com/document/d/' + f.id + '/edit', getBody: () => d.body, saveAndClose: () => { f.updated = agora(); } };
      docs[f.id] = d; return d;
    },
    openById(id) { if (!docs[id]) throw new Error('doc inexistente'); return docs[id]; }
  };

  // ---- SpreadsheetApp ----
  const SpreadsheetApp = {
    create(nome) {
      const f = new MFile(nome, '', 'sheet', 'root'); const rows = [];
      const aba = {
        rows, setName: () => aba, setFrozenRows: () => aba,
        getLastRow: () => rows.length,
        getLastColumn: () => rows.reduce((m, r) => Math.max(m, (r || []).length), 0),
        getRange(a, b, c, d) {
          if (typeof a === 'string') throw new Error('notação A1 não simulada');
          const nr = c || 1, nc = d || 1;
          const r = {
            getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((rows[a - 1 + i] || [])[b - 1 + j]) ?? '')),
            setValues: v => { v.forEach((linha, i) => { rows[a - 1 + i] = rows[a - 1 + i] || []; linha.forEach((x, j) => rows[a - 1 + i][b - 1 + j] = x); }); return r; },
            setFontWeight: () => r,
            setValue: x => { rows[a - 1][b - 1] = x; return r; },
            createTextFinder: t => ({ matchEntireCell: () => ({ findNext: () => { for (let i = 0; i < nr; i++) if (((rows[a - 1 + i] || [])[b - 1]) === t) return { getRow: () => a + i }; return null; } }) })
          };
          return r;
        },
        appendRow: r => { rows.push(r); log.sheetRows.push(r); }
      };
      log.sheet = aba;
      const ss = { getId: () => f.id, getSheets: () => [aba], getUrl: () => 'https://sheets/' + f.id };
      sheets[f.id] = ss; return ss;
    },
    openById(id) { if (!sheets[id]) throw new Error('planilha inexistente'); return sheets[id]; }
  };

  // ---- Propriedades, cache, trava ----
  const props = Object.assign({}, opts.props || {});
  const PropertiesService = { getScriptProperties: () => ({ getProperty: k => props[k] === undefined ? null : props[k], setProperty: (k, v) => { props[k] = v; } }) };
  const cacheMap = {};
  const CacheService = { getScriptCache: () => ({ get: k => cacheMap[k] || null, put: (k, v) => { if (Buffer.byteLength(String(v)) > 100 * 1024) throw new Error('Argument too large: value'); cacheMap[k] = v; } }) };
  const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };

  // ---- UrlFetchApp ----
  const resposta = (cod, corpoObj) => ({ getResponseCode: () => cod, getContentText: () => typeof corpoObj === 'string' ? corpoObj : JSON.stringify(corpoObj) });
  function tokeninfo(url) {
    const tok = decodeURIComponent(url.split('id_token=')[1]);
    const base = { aud: 'client-123', iss: 'https://accounts.google.com', email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3600) };
    if (tok === 'tok-ok' || tok.endsWith('.tok-ok')) return resposta(200, Object.assign(base, { email: 'pstennisteam@gmail.com' }));
    if (tok === 'tok-estranho') return resposta(200, Object.assign(base, { email: 'intruso@gmail.com' }));
    if (tok === 'tok-outroapp') return resposta(200, Object.assign(base, { email: 'pstennisteam@gmail.com', aud: 'outro' }));
    return resposta(400, { error: 'invalid_token' });
  }
  function anthropic(req) {
    const corpo = JSON.parse(req.payload); log.claude.push({ headers: req.headers, corpo });
    if (opts.falhaClaude) return resposta(opts.falhaClaude, { error: { message: 'erro simulado' } });
    if (corpo.tool_choice || corpo.tools) return resposta(400, { error: { message: 'tool_choice: type "tool" and "any" are not supported for this model.' } });
    if (!corpo.thinking || corpo.thinking.type !== 'between_tools') { log.claude.pop(); log.claude.push({ headers: req.headers, corpo }); }
    if (corpo.thinking && ['enabled', 'disabled'].includes(corpo.thinking.type)) return resposta(400, { error: { message: 'thinking type not supported' } });
    if (!corpo.thinking) return resposta(200, { content: [{ type: 'thinking', thinking: '...' }], stop_reason: 'max_tokens', usage: { output_tokens: corpo.max_tokens } });
    const esq = corpo.output_config && corpo.output_config.format && corpo.output_config.format.schema;
    if (!esq) return resposta(400, { error: { message: 'sem output_config' } });
    const semAP = []; (function v(o, c) { if (o && typeof o === 'object') { if (o.type === 'object' && o.additionalProperties !== false) semAP.push(c); Object.keys(o).forEach(k => v(o[k], c + '.' + k)); } })(esq, '$');
    if (semAP.length) return resposta(400, { error: { message: 'additionalProperties false faltando em ' + semAP.join(',') } });
    log.esquemas = log.esquemas || []; log.esquemas.push(esq);
    if (esq.properties.exercicios) {
      log.treinos = log.treinos || []; log.treinos.push(corpo);
      const ctx = JSON.stringify(corpo.messages);
      const id = (/\[(t\d-[a-z]{3}-\d+)\]/.exec(ctx) || [])[1] || '';
      return resposta(200, { content: [{ type: 'text', text: JSON.stringify(opts.treinoClaude ? opts.treinoClaude(ctx, id) : {
        foco: 'O tema encontra o saque do plano — aproveite.',
        exercicios: [{ idBanco: id, nome: 'Do banco', como: 'Como fazer.', dose: '3 séries de 10', porque: 'Liga com o plano.' },
          { idBanco: 'id-inventado', nome: 'Com id inventado', como: 'x', dose: 'x', porque: 'x' },
          { idBanco: '', nome: 'Novo', como: 'x', dose: 'x', porque: 'x' }],
        atencao: 'Olhe o lançamento.' }) }], stop_reason: 'end_turn', usage: { output_tokens: 321 } });
    }
    const nome = esq.properties.classeSugerida ? 'diagnostico' : 'plano';
    const temQuadros = JSON.stringify(corpo.messages).includes('"type":"image"');
    const reav = JSON.stringify(corpo.messages).includes('TIPO DE AULA: Reavaliação');
    let input;
    const opcoes = nome === 'diagnostico' ? esq.properties.classeSugerida.enum : [];
    if (nome === 'diagnostico') log.opcoesClasse = opcoes;
    if (nome === 'diagnostico') input = {
      classeSugerida: opts.classeClaude ? opts.classeClaude(opcoes, JSON.stringify(corpo.messages)) : opcoes[1],
      resumo: 'Você tem uma base boa — se movimenta bem e lê a bola cedo. O saque ainda segura o jogo.',
      justificativa: 'A média ficou na faixa da classe sugerida e o jogo bate com a descrição do ITN.',
      fortes: ['Movimentação lateral rápida.', 'Forehand com preparação cedo.', 'Disposição até o fim da aula.'],
      melhorar: ['Saque: lançamento irregular.', 'Backhand curto.', 'Volta à posição de espera.'],
      golpes: [{ golpe: 'Forehand', vi: 'Contato perto do corpo.', corrigir: 'Bata à frente do pé da frente.', exercicio: 'Cesto com alvo, 3 séries de 15.' },
        { golpe: 'Backhand', vi: 'Braço trava no contato.', corrigir: 'Deixe a mão esquerda conduzir.', exercicio: 'Só com a mão esquerda, 3 séries de 10.' },
        { golpe: 'Golpe inventado', vi: 'x', corrigir: 'x', exercicio: 'x' }],
      saque: temQuadros ? { quadros: [{ fase: 'Preparação', obs: 'Postura lateral correta.' }, { fase: 'Lançamento', obs: 'Bola atrás da cabeça.' }], bom: 'Ritmo tranquilo.', prioridade: 'Lançamento sempre igual.' } : undefined
    };
    else input = {
      planoTitulo: reav ? 'Próximo ciclo · 8 semanas · 1 aula por semana' : '12 semanas · 1 aula por semana',
      plano: (reav ? [['Semanas 9–12', 'Saque com direção', false], ['Semanas 13 a 16', 'Jogo de rede', true]] : [['Semanas 1 a 4', 'Base técnica', false], ['Semanas 5 a 8', 'Consistência', true], ['Semanas 9 a 12', 'Jogo', false]])
        .map(([s, t, r]) => ({ semanas: s, titulo: t, reavaliacao: r, itens: [{ foco: 'Lançamento do saque', exercicio: 'Lançar e deixar cair na raquete.' }, { foco: 'Backhand', exercicio: 'Alimentação lenta.' }, { foco: 'Pontos', exercicio: 'Games curtos.' }] })),
      casa: ['Lançamento do saque: 5 minutos por dia.', 'Movimento do backhand sem bola.'],
      equipamentoObs: 'A raquete está adequada ao seu momento.',
      proximo: { recomendacao: 'Aula individual, 1 vez por semana', motivo: 'O saque pede correções finas.', texto: 'A próxima aula começa pela fase 1. Na semana 8 filmamos de novo.' }
    };
    if (nome === 'diagnostico' && opts.caixaAlta) { input.classeSugerida = input.classeSugerida.toUpperCase(); input.golpes[0].golpe = input.golpes[0].golpe.toUpperCase(); }
    return resposta(200, { content: [{ type: 'text', text: JSON.stringify(input) }], stop_reason: 'end_turn', usage: { output_tokens: 1234 } });
  }
  const UrlFetchApp = {
    fetch(url, o) {
      if (url.includes('tokeninfo')) return tokeninfo(url);
      if (url.includes('treinos-por-tema.json')) { log.banco = (log.banco || 0) + 1; if (opts.bancoStatus) return resposta(opts.bancoStatus, 'erro'); return resposta(200, opts.banco || fs.readFileSync(require('path').join(__dirname, '..', '..', 'professor', 'treinos-por-tema.json'), 'utf8')); }
      throw new Error('url inesperada ' + url);
    },
    fetchAll(reqs) { return reqs.map(r => { if (r.url.includes('anthropic')) return anthropic(r); throw new Error('url inesperada'); }); }
  };

  const Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256', MD5: 'md5' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, s) => [...crypto.createHash(alg).update(s, 'utf8').digest()].map(b => b > 127 ? b - 256 : b),
    base64Decode: b => [...Buffer.from(b, 'base64')],
    newBlob: (bytes, mime, name) => ({ __blob: true, bytes: Buffer.from(bytes.map(b => b & 255)), mime, name }),
    base64EncodeWebSafe: b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    formatDate: () => '25/11/2026',
    getUuid: () => crypto.randomUUID(),
    sleep: () => {}
  };
  const ContentService = { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) };
  const MailApp = { sendEmail: o => log.mails.push(o) };
  const Session = { getEffectiveUser: () => ({ getEmail: () => 'pstennisteam@gmail.com' }) };
  const Logger = { log: m => log.logs.push(String(m)) };

  const ctx = vm.createContext({ DriveApp, DocumentApp, SpreadsheetApp, PropertiesService, CacheService, LockService, UrlFetchApp, Utilities, ContentService, MailApp, Session, Logger, console, JSON, Date, Math, Error, Object, Array, String, Number, encodeURIComponent, decodeURIComponent, Buffer });
  vm.runInContext(fs.readFileSync(opts.codigo || require('path').join(__dirname, '..', 'Code.gs'), 'utf8') + '\n;this.__ACOES = ACOES;', ctx, { filename: 'Code.gs' });
  const post = obj => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(obj) } }).getContent());
  const editarDoc = (docId, fn) => { fn(docs[docId].body.filhos); files[docId].updated = agora() + 10000; relogio += 10000; };
  return { ctx, post, log, props, files, folders, docs, editarDoc };
}
module.exports = { criarAmbiente };
