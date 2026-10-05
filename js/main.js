/* =========================================================
   pstennisteam | Interações da página
   1. Configuração (número do WhatsApp)
   2. Links de WhatsApp com mensagem pronta
   3. Menu mobile
   4. Destaque do menu conforme a seção visível
   5. Botão flutuante do WhatsApp
   6. Cards de aulas que viram
   7. Teste "Qual aula é para você?"
   8. Perguntas frequentes (uma aberta por vez)
   9. Aviso de privacidade
   10. Rally na quadra do topo
   11. Vídeos e ano do rodapé
   ========================================================= */

(function () {
  'use strict';

  /* ---------- 1. Configuração ---------- */
  var CONFIG = {
    // Número com código do país e DDD, só dígitos. Ex.: 5531987654321
    whatsapp: '5531995869025',
    // Número como aparece na página. Ex.: (31) 98765-4321
    // Enquanto estiver vazio, a linha "ou ligue" e o telefone do rodapé ficam ocultos.
    telefoneExibido: '(31) 99586-9085'
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function whatsappUrl(message) {
    return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(message);
  }

  /* ---------- 2. Links de WhatsApp ---------- */
  // Todo elemento com data-whatsapp="mensagem" vira um link para o WhatsApp
  document.querySelectorAll('[data-whatsapp]').forEach(function (el) {
    el.setAttribute('href', whatsappUrl(el.getAttribute('data-whatsapp')));
  });

  // Telefone exibido e link de ligação
  document.querySelectorAll('[data-phone]').forEach(function (el) {
    if (!CONFIG.telefoneExibido) {
      var holder = el.closest('.cta__phone, li');
      if (holder && holder.classList.contains('cta__phone')) holder.hidden = true;
      else if (holder) el.textContent = 'fale conosco';
      return;
    }
    el.textContent = CONFIG.telefoneExibido;
    if (el.tagName === 'A') {
      el.setAttribute('href', 'tel:+' + CONFIG.whatsapp);
    }
  });

  /* ---------- 3. Menu mobile ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('menu-principal');
  var mobileQuery = window.matchMedia('(max-width: 1080px)');

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Fecha ao escolher um link
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a') && mobileQuery.matches) setMenu(false);
    });

    // Fecha com a tecla Esc e devolve o foco ao botão
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setMenu(false);
        toggle.focus();
      }
    });

    // Se a tela aumentar com o menu aberto, fecha
    mobileQuery.addEventListener('change', function (event) {
      if (!event.matches) setMenu(false);
    });
  }

  /* ---------- 4. Destaque do menu ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.main-nav__list a[href^="#"]'));
  var sectionsById = {};
  navLinks.forEach(function (link) {
    var section = document.querySelector(link.getAttribute('href'));
    if (section) sectionsById[section.id] = link;
  });

  if ('IntersectionObserver' in window && navLinks.length) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          navLinks.forEach(function (l) { l.classList.remove('is-active'); l.removeAttribute('aria-current'); });
          var active = sectionsById[entry.target.id];
          if (active) {
            active.classList.add('is-active');
            active.setAttribute('aria-current', 'true');
          }
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    Object.keys(sectionsById).forEach(function (id) {
      navObserver.observe(document.getElementById(id));
    });
    // No topo da página (e nas seções sem link no menu) nenhum item fica destacado
    ['inicio', 'dicas', 'faq', 'qual-aula'].forEach(function (id) {
      var s = document.getElementById(id);
      if (s) navObserver.observe(s);
    });
  }

  /* ---------- 5. Botão flutuante do WhatsApp ---------- */
  // Aparece depois da primeira tela e some sobre a seção de contato,
  // onde já existe um botão grande de WhatsApp.
  var floatBtn = document.querySelector('.wa-float');
  var hero = document.getElementById('inicio');
  var contact = document.getElementById('contato');

  if (floatBtn && hero && 'IntersectionObserver' in window) {
    var heroVisible = true;
    var contactVisible = false;
    var updateFloat = function () {
      floatBtn.classList.toggle('is-visible', !heroVisible && !contactVisible);
    };
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
      updateFloat();
    }, { threshold: 0.15 }).observe(hero);
    if (contact) {
      new IntersectionObserver(function (entries) {
        contactVisible = entries[0].isIntersecting;
        updateFloat();
      }, { threshold: 0.3 }).observe(contact);
    }
  } else if (floatBtn) {
    floatBtn.classList.add('is-visible');
  }

  /* ---------- 6. Cards de aulas que viram ---------- */
  // Frente = Fama Tennis, verso = Condomínio
  document.querySelectorAll('.plan').forEach(function (card) {
    var front = card.querySelector('.plan__face--front');
    var back = card.querySelector('.plan__face--back');
    card.addEventListener('click', function () {
      var flipped = card.classList.toggle('is-flipped');
      card.setAttribute('aria-pressed', String(flipped));
      front.setAttribute('aria-hidden', String(flipped));
      back.setAttribute('aria-hidden', String(!flipped));
    });
  });

  /* ---------- 7. Teste ---------- */
  var quizForm = document.getElementById('quiz-questions');
  if (quizForm) initQuiz();

  function initQuiz() {
    var state = { quem: null, exp: null, torneio: null, nivel: null, formato: null, turnos: {} };
    var shownKeys = [];

    var el = {
      progress: document.getElementById('quiz-progress'),
      empty: document.getElementById('quiz-empty'),
      card: document.getElementById('quiz-card'),
      title: document.getElementById('result-title'),
      forWho: document.getElementById('result-for'),
      desc: document.getElementById('result-desc'),
      whatsapp: document.getElementById('result-whatsapp'),
      extra: document.getElementById('result-extra'),
      extraText: document.getElementById('result-extra-text'),
      message: document.getElementById('result-message'),
      reset: document.getElementById('quiz-reset')
    };

    var TURNOS = [
      { id: 'manha', label: 'Manhã', txt: 'de manhã' },
      { id: 'tarde', label: 'Tarde', txt: 'à tarde' },
      { id: 'noite', label: 'Noite', txt: 'à noite' },
      { id: 'fds', label: 'Fim de semana', txt: 'no fim de semana' }
    ];

    var MODALIDADE = {
      sozinho: { titulo: 'Individual', msg: 'aula individual' },
      parceiro: { titulo: 'Dupla', msg: 'aula em dupla' },
      grupo: { titulo: 'Grupo', msg: 'aula em grupo de 4 pessoas' },
      experimentar: { titulo: 'Aula avulsa', msg: 'uma aula avulsa' }
    };

    var DESCRICAO = {
      aprender: 'Fundamentos no seu ritmo, com diagnóstico já na primeira aula.',
      saude: 'Aulas dinâmicas, com bastante movimento e troca de bola.',
      tecnica: 'Ajuste fino dos golpes, com análise da sua evolução em vídeo.',
      competir: 'Base técnica e tática pensada para quem quer jogar torneios.'
    };

    // Textos que mudam quando a aula é para filho ou filha
    function textos(filho) {
      return {
        exp: filho
          ? { aprender: 'aprender do zero', saude: 'se exercitar e se divertir', tecnica: 'melhorar a técnica', competir: 'competir em torneios' }
          : { aprender: 'aprender do zero', saude: 'me exercitar e me divertir', tecnica: 'melhorar a técnica', competir: 'competir em torneios' },
        nivel: filho
          ? { nunca: 'Ele ou ela nunca jogou tênis', pouco: 'Ele ou ela já jogou um pouco', frequente: 'Ele ou ela joga com frequência' }
          : { nunca: 'Nunca joguei tênis', pouco: 'Já joguei um pouco', frequente: 'Jogo com frequência' },
        torneio: filho
          ? { ainda: 'Ainda não joga torneios', internos: 'Já joga torneios internos ou amistosos', federados: 'Já joga circuitos federados' }
          : { ainda: 'Ainda não jogo torneios', internos: 'Já jogo torneios internos ou amistosos', federados: 'Já jogo circuitos federados' }
      };
    }

    // Monta a lista de perguntas conforme as respostas atuais
    function perguntas() {
      var filho = state.quem === 'filho';
      var T = function (eu, fi) { return filho ? fi : eu; };
      var lista = [
        { key: 'quem', text: 'Para quem são as aulas?', options: [
          { id: 'eu', label: 'Para mim' },
          { id: 'filho', label: 'Para meu filho ou filha' }
        ] },
        { key: 'exp', text: T('Qual é o seu objetivo no tênis?', 'Qual é o objetivo dele ou dela no tênis?'), options: [
          { id: 'aprender', label: 'Aprender do zero' },
          { id: 'saude', label: T('Me exercitar e me divertir', 'Se exercitar e se divertir') },
          { id: 'tecnica', label: 'Melhorar a técnica' },
          { id: 'competir', label: 'Competir em torneios' }
        ] }
      ];
      // Só aparece para quem quer competir
      if (state.exp === 'competir') {
        lista.push({ key: 'torneio', text: T('Você já joga torneios?', 'Ele ou ela já joga torneios?'), options: [
          { id: 'ainda', label: 'Ainda não' },
          { id: 'internos', label: 'Torneios internos ou amistosos' },
          { id: 'federados', label: 'Circuitos federados' }
        ] });
      }
      lista.push({ key: 'nivel', text: T('Você já jogou tênis?', 'Ele ou ela já jogou tênis?'), options: [
        { id: 'nunca', label: T('Nunca joguei', 'Nunca jogou') },
        { id: 'pouco', label: T('Já joguei um pouco', 'Já jogou um pouco') },
        { id: 'frequente', label: T('Jogo com frequência', 'Joga com frequência') }
      ] });
      lista.push({ key: 'formato', text: T('Com quem você quer treinar?', 'Como ele ou ela prefere treinar?'), options: [
        { id: 'sozinho', label: T('Só eu', 'Aula só para ele ou ela') },
        { id: 'parceiro', label: T('Com um parceiro', 'Com um irmão ou amigo') },
        { id: 'grupo', label: 'Em grupo de 4' },
        { id: 'experimentar', label: T('Quero só experimentar', 'Só experimentar primeiro') }
      ] });
      lista.push({ key: 'turnos', multi: true, text: T('Quando você consegue treinar?', 'Quando ele ou ela consegue treinar?'), hint: '(pode marcar mais de um)', options: TURNOS });
      return lista;
    }

    function turnosMarcados() {
      return TURNOS.filter(function (t) { return state.turnos[t.id]; });
    }

    function respondida(key) {
      return key === 'turnos' ? turnosMarcados().length > 0 : !!state[key];
    }

    function render(focusKey, focusValue) {
      var lista = perguntas();
      var previous = shownKeys;
      shownKeys = lista.map(function (q) { return q.key; });
      quizForm.innerHTML = '';

      lista.forEach(function (q, index) {
        var fieldset = document.createElement('fieldset');
        fieldset.className = 'question';
        if (previous.length && previous.indexOf(q.key) === -1) fieldset.classList.add('question--new');

        var legend = document.createElement('legend');
        legend.textContent = (index + 1) + '. ' + q.text + ' ';
        if (q.hint) {
          var hint = document.createElement('span');
          hint.className = 'question__hint';
          hint.textContent = q.hint;
          legend.appendChild(hint);
        }
        fieldset.appendChild(legend);

        var options = document.createElement('div');
        options.className = 'question__options';

        q.options.forEach(function (opt) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'pill';
          btn.textContent = opt.label;
          btn.dataset.key = q.key;
          btn.dataset.value = opt.id;
          var pressed = q.multi ? !!state.turnos[opt.id] : state[q.key] === opt.id;
          btn.setAttribute('aria-pressed', String(pressed));
          options.appendChild(btn);
        });

        fieldset.appendChild(options);
        quizForm.appendChild(fieldset);
      });

      // Mantém o foco no botão clicado depois de redesenhar
      if (focusKey) {
        var target = quizForm.querySelector('[data-key="' + focusKey + '"][data-value="' + focusValue + '"]');
        if (target) target.focus({ preventScroll: true });
      }

      var total = lista.length;
      var feitas = lista.filter(function (q) { return respondida(q.key); }).length;
      el.progress.textContent = feitas + ' de ' + total + ' respondidas';

      renderResult(feitas === total);
    }

    function renderResult(done) {
      el.empty.hidden = done;
      el.card.hidden = !done;
      if (!done) return;

      var filho = state.quem === 'filho';
      var t = textos(filho);
      var m = MODALIDADE[state.formato];
      var competir = state.exp === 'competir';

      var quandoLista = turnosMarcados().map(function (x) { return x.txt; });
      var quando = quandoLista.length > 1
        ? quandoLista.slice(0, -1).join(', ') + ' e ' + quandoLista[quandoLista.length - 1]
        : quandoLista[0];

      var torneio = competir && state.torneio ? ' ' + t.torneio[state.torneio] + '.' : '';

      var mensagem = filho
        ? 'Olá! Vim pelo site e procuro aulas de tênis para meu filho ou filha. O objetivo é ' + t.exp[state.exp] + '.' + torneio + ' ' + t.nivel[state.nivel] + ' e gostaríamos de agendar ' + m.msg + '. Ele ou ela tem disponibilidade ' + quando + '.'
        : 'Olá! Vim pelo site. Meu objetivo no tênis é ' + t.exp[state.exp] + '.' + torneio + ' ' + t.nivel[state.nivel] + ' e gostaria de agendar ' + m.msg + '. Tenho disponibilidade ' + quando + '.';

      el.title.textContent = m.titulo;
      el.forWho.textContent = filho ? 'Para seu filho ou filha ' + t.exp[state.exp] : 'Para quem quer ' + t.exp[state.exp];
      el.desc.textContent = DESCRICAO[state.exp];
      el.message.textContent = mensagem;
      el.whatsapp.setAttribute('href', whatsappUrl(mensagem));

      // Sugestão complementar
      var extra = '';
      var href = '#programas';
      if (competir) {
        extra = 'Combine com: Preparação para torneios';
      } else if (state.exp === 'tecnica') {
        extra = 'Combine com: Clínicas de fim de semana';
      } else if (state.nivel === 'nunca' && state.formato !== 'experimentar') {
        extra = 'Dica: comece com uma aula avulsa para conhecer o método';
        href = '#aulas';
      }
      el.extra.hidden = !extra;
      el.extraText.textContent = extra;
      el.extra.setAttribute('href', href);
    }

    // Um único ouvinte para todos os botões do teste
    quizForm.addEventListener('click', function (event) {
      var btn = event.target.closest('.pill');
      if (!btn) return;
      var key = btn.dataset.key;
      var value = btn.dataset.value;

      if (key === 'turnos') {
        state.turnos[value] = !state.turnos[value];
      } else {
        state[key] = value;
        // A pergunta de torneios some se o objetivo mudar
        if (key === 'exp' && value !== 'competir') state.torneio = null;
      }
      render(key, value);
    });

    el.reset.addEventListener('click', function () {
      state = { quem: null, exp: null, torneio: null, nivel: null, formato: null, turnos: {} };
      shownKeys = [];
      render();
      var first = quizForm.querySelector('.pill');
      if (first) first.focus();
    });

    render();
  }

  /* ---------- 8. Perguntas frequentes ---------- */
  // Navegadores recentes já fecham os outros itens pelo atributo name="faq".
  // Este trecho garante o mesmo comportamento nos demais.
  var faqItems = document.querySelectorAll('.faq__item');
  faqItems.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;
      faqItems.forEach(function (other) {
        if (other !== item && other.open) other.open = false;
      });
    });
  });

  /* ---------- 9. Aviso de privacidade ---------- */
  var PRIVACY_KEY = 'ps-aviso-privacidade-visto';
  var banner = document.getElementById('privacy-banner');
  var dialog = document.getElementById('privacy-dialog');

  function privacySeen() {
    try { return localStorage.getItem(PRIVACY_KEY) === '1'; } catch (e) { return false; }
  }
  function markPrivacySeen() {
    try { localStorage.setItem(PRIVACY_KEY, '1'); } catch (e) { /* navegador sem armazenamento */ }
    if (banner) banner.hidden = true;
    document.body.classList.remove('privacy-pending');
  }

  if (banner && !privacySeen()) {
    banner.hidden = false;
    document.body.classList.add('privacy-pending');
  }

  var okBtn = document.getElementById('privacy-ok');
  if (okBtn) okBtn.addEventListener('click', markPrivacySeen);

  var lastTrigger = null;
  document.querySelectorAll('[data-open-privacy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!dialog) return;
      lastTrigger = btn;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    });
  });

  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  if (dialog) {
    dialog.querySelectorAll('[data-close-privacy]').forEach(function (btn) {
      btn.addEventListener('click', closeDialog);
    });
    // Clique fora da janela fecha
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) closeDialog();
    });
    // Ler o aviso até o fim também conta como visto; o foco volta para onde estava
    dialog.addEventListener('close', function () {
      markPrivacySeen();
      if (lastTrigger && document.body.contains(lastTrigger) && !lastTrigger.closest('[hidden]')) lastTrigger.focus();
    });
  }

  /* ---------- 10. Rally na quadra do topo ---------- */
  // A bolinha cruza a quadra de um lado para o outro, deixa um rastro pontilhado
  // que vai sumindo e termina no mesmo ponto em que começou: o rally nunca acaba.
  var rally = document.querySelector('[data-rally]');
  if (rally) initRally(rally);

  function initRally(container) {
    var SVG_NS = 'http://www.w3.org/2000/svg';

    // Pontos de batida na quadra vertical (viewBox 360 x 734).
    // Rede em y = 367; jogador de baixo perto de y = 690, de cima perto de y = 50.
    // O último trecho volta ao primeiro ponto, fechando o ciclo.
    var HITS = [
      [215, 690], [110, 50], [255, 700], [95, 62],
      [150, 684], [265, 46], [120, 696], [232, 56]
    ];
    var SHOT_MS = 1150;       // duração de cada batida
    var BOUNCE_AT = 0.8;      // ponto do trajeto em que a bola quica no outro lado
    var DOT_GAP = 15;         // distância entre os pontos do rastro
    var TRAIL_MS = 1500;      // tempo para cada ponto do rastro sumir
    var CYCLE_MS = HITS.length * SHOT_MS;

    // Uma curva leve em cada batida sugere o efeito da bola
    var shots = HITS.map(function (from, i) {
      var to = HITS[(i + 1) % HITS.length];
      var mx = (from[0] + to[0]) / 2;
      var my = (from[1] + to[1]) / 2;
      var dx = to[0] - from[0];
      var dy = to[1] - from[1];
      var len = Math.sqrt(dx * dx + dy * dy);
      var bend = (i % 2 === 0 ? 1 : -1) * 34;
      return { from: from, to: to, ctrl: [mx - (dy / len) * bend, my + (dx / len) * bend] };
    });

    function pointAt(shot, t) {
      var u = 1 - t;
      return [
        u * u * shot.from[0] + 2 * u * t * shot.ctrl[0] + t * t * shot.to[0],
        u * u * shot.from[1] + 2 * u * t * shot.ctrl[1] + t * t * shot.to[1]
      ];
    }

    // Altura da bola em cada momento da batida:
    // sai da raquete na altura da cintura, sobe, desce até tocar o chão (quique)
    // e sobe de novo até a altura em que o outro jogador rebate.
    var HIT_H = 14;       // altura no momento da batida
    var PEAK_H = 46;      // altura máxima antes do quique
    var REBOUND_H = 16;   // altura extra depois do quique
    function heightAt(t) {
      if (t < BOUNCE_AT) {
        var s = t / BOUNCE_AT;
        return HIT_H * (1 - s) + 4 * PEAK_H * s * (1 - s);
      }
      var s2 = (t - BOUNCE_AT) / (1 - BOUNCE_AT);
      return HIT_H * s2 + 4 * REBOUND_H * s2 * (1 - s2);
    }

    // Vista de cima com luz vinda de um lado: quanto mais alta a bola,
    // mais ela se afasta da própria sombra. No quique, bola e sombra se encontram.
    function airPoint(ground, h) {
      return [ground[0] - 0.8 * h, ground[1] - 0.35 * h];
    }

    // Quadra vertical (computador) e horizontal (celular): a horizontal é a mesma
    // quadra girada, então basta trocar x por y.
    var views = [];
    container.querySelectorAll('svg').forEach(function (svg) {
      var horizontal = svg.classList.contains('court--horizontal');
      views.push({
        svg: svg,
        trail: svg.querySelector('.court__trail'),
        ball: svg.querySelector('.court__ball'),
        shadow: (function () {
          var s = document.createElementNS(SVG_NS, 'ellipse');
          s.setAttribute('class', 'court__shadow');
          var ball = svg.querySelector('.court__ball');
          ball.parentNode.insertBefore(s, ball);
          return s;
        })(),
        map: horizontal ? function (p) { return [p[1], p[0]]; } : function (p) { return p; },
        // No celular a quadra aparece menor, então bola e rastro ganham escala
        k: horizontal ? 1.7 : 1,
        dots: [],
        rings: []
      });
    });

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var running = false;
    var rafId = null;
    var start = null;
    var lastDrop = null;
    var lastShot = -1;

    function addDot(view, p, now) {
      var c = document.createElementNS(SVG_NS, 'circle');
      var q = view.map(p);
      c.setAttribute('cx', q[0].toFixed(1));
      c.setAttribute('cy', q[1].toFixed(1));
      c.setAttribute('r', (2.6 * view.k).toFixed(1));
      c.setAttribute('class', 'court__dot');
      view.trail.appendChild(c);
      view.dots.push({ el: c, born: now });
    }

    function addRing(view, p, now) {
      var c = document.createElementNS(SVG_NS, 'circle');
      var q = view.map(p);
      c.setAttribute('cx', q[0].toFixed(1));
      c.setAttribute('cy', q[1].toFixed(1));
      c.setAttribute('r', (4 * view.k).toFixed(1));
      c.setAttribute('class', 'court__bounce');
      c.setAttribute('stroke-width', (2.5 * view.k).toFixed(1));
      view.trail.appendChild(c);
      view.rings.push({ el: c, born: now });
    }

    function frame(now) {
      if (start === null) start = now;
      var elapsed = (now - start) % CYCLE_MS;
      var index = Math.floor(elapsed / SHOT_MS);
      var t = (elapsed - index * SHOT_MS) / SHOT_MS;
      var shot = shots[index];
      var g = pointAt(shot, t);
      var h = heightAt(t);
      var p = airPoint(g, h);
      var r = 11 + 0.11 * h;

      // Rastro: um ponto a cada DOT_GAP unidades percorridas
      if (!lastDrop || Math.hypot(p[0] - lastDrop[0], p[1] - lastDrop[1]) >= DOT_GAP) {
        views.forEach(function (v) { addDot(v, p, now); });
        lastDrop = p;
      }
      // Marca do quique
      if (index !== lastShot) {
        lastShot = index;
        shot.bounced = false;
      }
      if (!shot.bounced && t >= BOUNCE_AT) {
        shot.bounced = true;
        var b = pointAt(shot, BOUNCE_AT);
        views.forEach(function (v) { addRing(v, b, now); });
      }

      views.forEach(function (v) {
        var gq = v.map(g);
        v.shadow.setAttribute('cx', gq[0].toFixed(1));
        v.shadow.setAttribute('cy', gq[1].toFixed(1));
        v.shadow.setAttribute('rx', (10 * v.k).toFixed(1));
        v.shadow.setAttribute('ry', (7 * v.k).toFixed(1));
        v.shadow.setAttribute('opacity', (0.42 - 0.005 * h).toFixed(3));
        var q = v.map(p);
        v.ball.setAttribute('cx', q[0].toFixed(1));
        v.ball.setAttribute('cy', q[1].toFixed(1));
        v.ball.setAttribute('r', (r * v.k).toFixed(2));

        v.dots = v.dots.filter(function (d) {
          var age = (now - d.born) / TRAIL_MS;
          if (age >= 1) { d.el.remove(); return false; }
          d.el.setAttribute('opacity', (0.8 * (1 - age)).toFixed(3));
          return true;
        });
        v.rings = v.rings.filter(function (d) {
          var age = (now - d.born) / 700;
          if (age >= 1) { d.el.remove(); return false; }
          d.el.setAttribute('r', ((4 + 14 * age) * v.k).toFixed(1));
          d.el.setAttribute('opacity', (0.9 * (1 - age)).toFixed(3));
          return true;
        });
      });

      rafId = requestAnimationFrame(frame);
    }

    function play() {
      if (running || reduce.matches) return;
      running = true;
      start = null;
      lastDrop = null;
      lastShot = -1;
      rafId = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      // Ao parar, limpa o rastro e devolve a bola ao ponto inicial
      views.forEach(function (v) {
        v.dots.concat(v.rings).forEach(function (d) { d.el.remove(); });
        v.dots = [];
        v.rings = [];
        var q = v.map(airPoint(HITS[0], HIT_H));
        v.ball.setAttribute('cx', q[0]);
        v.ball.setAttribute('cy', q[1]);
        v.ball.setAttribute('r', (11 + 0.11 * HIT_H) * v.k);
        var sq = v.map(HITS[0]);
        v.shadow.setAttribute('cx', sq[0]);
        v.shadow.setAttribute('cy', sq[1]);
        v.shadow.setAttribute('rx', 10 * v.k);
        v.shadow.setAttribute('ry', 7 * v.k);
        v.shadow.setAttribute('opacity', 0.35);
      });
    }

    // Só anima enquanto o topo da página está visível
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) play(); else stop();
      }, { threshold: 0.1 }).observe(container);
    } else {
      play();
    }

    // Respeita a preferência de reduzir movimento, inclusive se mudar com a página aberta
    reduce.addEventListener('change', function () {
      if (reduce.matches) stop(); else play();
    });
  }

  /* ---------- 11. Vídeos e ano ---------- */
  // Com "reduzir movimento" ativado no sistema, o vídeo do topo não roda sozinho
  var heroVideo = document.querySelector('.hero__video');
  if (heroVideo && reduceMotion) {
    heroVideo.removeAttribute('autoplay');
    heroVideo.pause();
    heroVideo.setAttribute('controls', '');
  }

  var ano = document.getElementById('ano');
  if (ano) ano.textContent = new Date().getFullYear();
})();
