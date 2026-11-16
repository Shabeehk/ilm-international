/* ILM International — Meta Pixel (only for ILM's own ad account, not Kisanic)
   Put the ILM pixel ID between the quotes below, e.g. '123456789012345'.
   While it is empty, nothing is loaded and nothing is sent to Meta.
   The pixel runs only on the public pages (index.html, fees.html),
   never inside the student portal. */
(function () {
  var ILM_PIXEL_ID = '1110432051810085';

  if (!/^\d{10,20}$/.test(ILM_PIXEL_ID)) { window.ilmTrack = function () {}; return; }
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', ILM_PIXEL_ID);
  fbq('track', 'PageView');
  // used by app.js: ilmTrack('Lead') after the registration form, ilmTrack('Contact') on WhatsApp
  window.ilmTrack = function (event, data) { try { fbq('track', event, data || {}); } catch (e) {} };
})();
