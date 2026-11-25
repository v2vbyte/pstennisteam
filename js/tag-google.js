/* =========================================================
   pstennisteam | Tag do Google: conversão, Analytics e consentimento
   A tag do Google (gtag.js, AW-18593472042) e o consentimento padrão ficam
   no <head> de cada página, no formato que o Google Ads detecta.
   Este arquivo vem logo depois e cuida de quatro coisas:

   1. Conversão "Contato" do Google Ads (clique no WhatsApp). Para não contar
      robôs e toques acidentais de anúncios de Display, só conta quando:
      - o clique é de verdade (não gerado por script);
      - o navegador não está em modo automatizado;
      - a pessoa está na página há pelo menos TEMPO_MINIMO segundos;
      - é o primeiro clique de WhatsApp nesta visita.
   2. Google Analytics 4 (GA4): só liga quando GA4 tiver o ID da propriedade
      ("G-" seguido de letras e números). Enquanto estiver vazio, nada muda.
   3. Eventos do GA4: "clique_whatsapp" (todo clique real em WhatsApp, com a
      seção de origem) e "teste_concluido" (resultado do teste "Qual aula",
      enviado por js/main.js com PSMedir.evento).
   4. PSConsentimento: usado pelas faixas de cookies das páginas. Uma escolha
      só vale para os cookies de anúncios e de estatística.
   ========================================================= */
(function () {
  'use strict';

  var CONVERSAO = 'AW-18593472042/XTxLCOjQ0b4dEKq8h6JF'; // conversão "Contato"
  var TEMPO_MINIMO = 4; // segundos na página antes de o clique contar

  // ID da propriedade do Google Analytics 4. Ex.: 'G-AB12CD34EF'. Vazio = GA4 desligado.
  var GA4 = 'G-F6X4LYW36W';

  // Chave da escolha no navegador. Mudou de 'ps-consentimento-anuncios' quando
  // o GA4 entrou, para pedir a escolha de novo com o texto atualizado.
  // Se mudar aqui, mude também no bloco de consentimento do <head> de cada página.
  var CHAVE = 'ps-consentimento';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  var gtag = window.gtag;

  if (GA4) gtag('config', GA4);

  function evento(nome, dados) {
    if (!GA4) return;
    var params = { send_to: GA4 };
    for (var k in dados) if (Object.prototype.hasOwnProperty.call(dados, k)) params[k] = dados[k];
    gtag('event', nome, params);
  }
  window.PSMedir = { evento: evento };

  var inicio = Date.now();
  var jaContou = false;

  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!link || !e.isTrusted || navigator.webdriver) return;

    // GA4: todo clique real, com a seção de onde veio
    var secao = link.closest('[id]');
    var origem = link.classList.contains('wa-float') ? 'botao-flutuante'
      : link.closest('footer') ? 'rodape'
      : secao ? secao.id : 'pagina';
    evento('clique_whatsapp', { origem: origem });

    // Google Ads: só o primeiro clique da visita, depois do tempo mínimo
    if (jaContou || (Date.now() - inicio) / 1000 < TEMPO_MINIMO) return;
    jaContou = true;
    gtag('event', 'conversion', { send_to: CONVERSAO, value: 1.0, currency: 'BRL' });
  });

  window.PSConsentimento = {
    escolha: function () {
      try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
    },
    definir: function (escolha) {
      try { localStorage.setItem(CHAVE, escolha); } catch (e) { /* navegador sem armazenamento */ }
      var valor = escolha === 'aceito' ? 'granted' : 'denied';
      gtag('consent', 'update', { ad_storage: valor, ad_user_data: valor, ad_personalization: valor, analytics_storage: valor });
    }
  };
})();
