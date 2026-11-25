/* =========================================================
   pstennisteam | Conversão do Google Ads e consentimento
   A tag do Google (gtag.js, AW-18593472042) e o consentimento padrão ficam
   no <head> de cada página, no formato que o Google Ads detecta.
   Este arquivo vem logo depois e cuida de duas coisas:

   1. Conversão "Contato" (clique no WhatsApp). Para não contar robôs
      e toques acidentais de anúncios de Display, só conta quando:
      - o clique é de verdade (não gerado por script);
      - o navegador não está em modo automatizado;
      - a pessoa está na página há pelo menos TEMPO_MINIMO segundos;
      - é o primeiro clique de WhatsApp nesta visita.
   2. PSConsentimento: usado pelas faixas de cookies das páginas.
   ========================================================= */
(function () {
  'use strict';

  var CONVERSAO = 'AW-18593472042/XTxLCOjQ0b4dEKq8h6JF'; // conversão "Contato"
  var TEMPO_MINIMO = 4; // segundos na página antes de o clique contar
  var CHAVE = 'ps-consentimento-anuncios';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  var gtag = window.gtag;

  var inicio = Date.now();
  var jaContou = false;

  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!link || jaContou) return;
    if (!e.isTrusted) return;
    if (navigator.webdriver) return;
    if ((Date.now() - inicio) / 1000 < TEMPO_MINIMO) return;
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
      gtag('consent', 'update', { ad_storage: valor, ad_user_data: valor, ad_personalization: valor });
    }
  };
})();
