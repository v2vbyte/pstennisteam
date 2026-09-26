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
   9. Vídeos e ano do rodapé
   ========================================================= */

(function () {
  'use strict';

  /* ---------- 1. Configuração ---------- */
  var CONFIG = {
    // Número com código do país e DDD, só dígitos. Ex.: 5531987654321
    whatsapp: '55319XXXXXXXX',
    // Número exibido na página (texto). Ex.: (31) 98765-4321
    telefoneExibido: '[telefone]'
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

  /* ---------- 9. Vídeos e ano ---------- */
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
