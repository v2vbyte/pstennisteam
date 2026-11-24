/* =========================================================
   pstennisteam | Tag do Google (Google Ads) com consentimento
   Carregado no <head> de TODAS as páginas, antes de qualquer outro script.

   - TAG_ID: tag do Google entregue pelo Google Ads (contêiner GTM-...).
   - CONVERSAO: "send_to" da conversão do clique no WhatsApp,
     no formato AW-123456789/AbCdEfGh. Enquanto tiver XXX, a conversão
     não é enviada (a tag continua carregando).
   - Consentimento (LGPD): a tag começa sem cookies de anúncio (modo de
     consentimento do Google) e só passa a usá-los depois que a pessoa
     toca em "Aceitar". A escolha vale para o site inteiro e fica salva
     no navegador. As páginas mostram a faixa e chamam PSConsentimento.
   ========================================================= */
(function () {
  'use strict';

  var TAG_ID = 'GTM-T9N2Z22P';
  var CONVERSAO = 'AW-XXXXXXXXX/ROTULO';
  var CHAVE = 'ps-consentimento-anuncios';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  var gtag = window.gtag;

  function salvo() {
    try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
  }

  // Padrão: tudo negado até a pessoa aceitar
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', true);
  if (salvo() === 'aceito') {
    gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
  }

  // Tag do Google (mesmo código entregue pelo Google Ads)
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=' + TAG_ID;
  document.head.appendChild(s);
  gtag('js', new Date());

  // Conversão: qualquer clique em link de WhatsApp, em qualquer página
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!link || CONVERSAO.indexOf('XXX') !== -1) return;
    gtag('event', 'conversion', { send_to: CONVERSAO });
  });

  // Usado pelas faixas de consentimento das páginas
  window.PSConsentimento = {
    escolha: salvo,
    definir: function (escolha) {
      try { localStorage.setItem(CHAVE, escolha); } catch (e) { /* navegador sem armazenamento */ }
      var valor = escolha === 'aceito' ? 'granted' : 'denied';
      gtag('consent', 'update', { ad_storage: valor, ad_user_data: valor, ad_personalization: valor });
    }
  };
})();
