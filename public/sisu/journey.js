/* Sisu landing page: the demo buttons and the replay of the bill example.
   Both are extras. Without this script the buttons lead to the example on this page and
   the example stands in its final state. No network, no storage. */
(function () {
  'use strict';

  const DEMO_LABEL = 'Open the Sisu demo';

  /* Where the demo lives. A filled <meta name="sisu-demo-url"> wins. Otherwise, when the
     Sisu app itself serves this page at /sisu/, the demo is the app's start page. On any
     other host "/" would be this page again, so the buttons keep their on-page target. */
  function demoAddress() {
    const meta = document.querySelector('meta[name="sisu-demo-url"]');
    const stated = meta === null ? '' : (meta.getAttribute('content') || '').trim();
    if (/^(https:\/\/|\/)/.test(stated)) {
      return stated;
    }
    const servedByApp = /^https?:$/.test(window.location.protocol) &&
      /^\/sisu\/(index\.html)?$/.test(window.location.pathname);
    return servedByApp ? '/' : '';
  }

  function wireDemoButtons() {
    const address = demoAddress();
    if (address === '') {
      return;
    }
    document.querySelectorAll('.demo-button').forEach(function (button) {
      button.setAttribute('href', address);
      button.textContent = DEMO_LABEL;
    });
  }

  /* Replay: a button, added here so it only exists when it works, puts the four steps back
     in waiting and lets them come in again. */
  function wireReplay() {
    const figure = document.querySelector('.journey-figure');
    const canMatch = typeof window.matchMedia === 'function';
    if (figure === null || !canMatch || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const steps = Array.from(figure.querySelectorAll('.step'));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'journey-replay';
    button.textContent = 'Play again';
    figure.appendChild(button);
    button.addEventListener('click', function () {
      if (!document.documentElement.classList.contains('js')) {
        return;
      }
      steps.forEach(function (step) {
        step.classList.remove('is-in');
        step.classList.add('is-waiting');
      });
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          steps.forEach(function (step) {
            step.classList.remove('is-waiting');
            step.classList.add('is-in');
          });
        });
      });
    });
  }

  wireDemoButtons();
  wireReplay();
})();
