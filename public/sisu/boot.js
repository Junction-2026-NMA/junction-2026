/* Runs in the head, before the first paint.
   It marks the page as scripted, so the stylesheets may close the menus and arm the
   fade-ins without a flash of the open state. page.js reports in when it has wired
   everything. If it never does (it failed to load, threw, or is very late), the mark is
   taken back and the page shows its plain layout: every link and every section visible. */
(function () {
  'use strict';

  const root = document.documentElement;
  const LATE_MS = 3000;

  function takeBackIfUnwired() {
    if (!root.hasAttribute('data-sisu-wired')) {
      root.classList.remove('js');
    }
  }

  root.classList.add('js');
  document.addEventListener('DOMContentLoaded', takeBackIfUnwired);
  window.setTimeout(takeBackIfUnwired, LATE_MS);
})();
