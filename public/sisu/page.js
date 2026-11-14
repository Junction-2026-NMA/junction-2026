/* Sisu landing page: the two header menus, the logo's text fallback, the fade-ins and the
   counting numbers. All of it is an extra on top of a page that is complete without scripts.
   Failure paths: if the wiring throws, the js class is removed and the plain layout
   returns. Without IntersectionObserver nothing is ever hidden and nothing counts.
   Reduced motion is read here as well, not only in the stylesheets. */
(function () {
  'use strict';

  const root = document.documentElement;
  const COUNT_MS = 1200;
  const FOLD_MARGIN = 48;
  const canMatch = typeof window.matchMedia === 'function';
  const reduceQuery = canMatch ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const wideQuery = canMatch ? window.matchMedia('(min-width: 1024px)') : null;
  const runningCounts = new Set();

  function motionAllowed() {
    return reduceQuery !== null && !reduceQuery.matches;
  }

  function isWide() {
    return wideQuery !== null && wideQuery.matches;
  }

  /* Menus: each button shows or hides its list and says so in aria-expanded. */

  function setOpen(button, holder, openClass, open) {
    holder.classList.toggle(openClass, open);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function wireHeader() {
    const header = document.querySelector('.site-header');
    const menuButton = header.querySelector('.menu-button');
    const segment = header.querySelector('.segment');
    const segmentButton = segment.querySelector('.segment-button');

    function closeSegment() {
      setOpen(segmentButton, segment, 'is-open', false);
    }

    menuButton.addEventListener('click', function () {
      const open = !header.classList.contains('is-menu-open');
      setOpen(menuButton, header, 'is-menu-open', open);
      if (!open) {
        closeSegment();
      }
    });

    segmentButton.addEventListener('click', function () {
      setOpen(segmentButton, segment, 'is-open', !segment.classList.contains('is-open'));
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') {
        return;
      }
      if (segment.classList.contains('is-open')) {
        closeSegment();
        segmentButton.focus();
        return;
      }
      if (header.classList.contains('is-menu-open') && !isWide()) {
        setOpen(menuButton, header, 'is-menu-open', false);
        menuButton.focus();
      }
    });

    /* From 1024px the segment list lies over the page: a click or a focus move outside closes it. */
    document.addEventListener('click', function (event) {
      if (isWide() && !segment.contains(event.target)) {
        closeSegment();
      }
    });

    segment.addEventListener('focusout', function (event) {
      const next = event.relatedTarget;
      if (isWide() && next instanceof Node && !segment.contains(next)) {
        closeSegment();
      }
    });
  }

  /* Counting numbers. The HTML holds the final text. A count changes it only while it
     runs, keeps the English format by hand (no locale), and always ends on the HTML text. */

  function withThousands(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function finishCounts() {
    Array.from(runningCounts).forEach(function (finish) {
      finish();
    });
  }

  function startCount(el) {
    const finalText = el.textContent;
    const parts = /^(\D*)(\d[\d,]*)((?:\.\d+)?\D*)$/.exec(finalText);
    const target = parts === null ? 0 : Number(parts[2].replace(/,/g, ''));
    if (!motionAllowed() || document.hidden || el.children.length > 0 || !(target > 0)) {
      return;
    }

    const spoken = document.createElement('span');
    const countMs = Number(el.getAttribute('data-count-ms')) || COUNT_MS;
    const startedAt = performance.now();
    let frame = 0;
    let timer = 0;

    function show(value) {
      el.textContent = parts[1] + withThousands(value) + parts[3];
    }

    function finish() {
      if (!runningCounts.delete(finish)) {
        return;
      }
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      el.textContent = finalText;
      el.removeAttribute('aria-hidden');
      spoken.remove();
    }

    function step(now) {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / countMs));
      if (progress >= 1) {
        finish();
        return;
      }
      show(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      frame = window.requestAnimationFrame(step);
    }

    /* Screen readers get the final value from a hidden copy while the visible one counts. */
    spoken.className = 'vh';
    spoken.textContent = finalText;
    el.setAttribute('aria-hidden', 'true');
    el.insertAdjacentElement('afterend', spoken);
    runningCounts.add(finish);
    show(0);
    frame = window.requestAnimationFrame(step);
    timer = window.setTimeout(finish, countMs + 150);
  }

  /* Fade-ins. Nothing is hidden on load, so a capture, a print-out or a reader ahead of the
     scroll gets the whole page. On the first scroll the blocks still below the view are put
     in waiting; each fades in, once, as soon as any part of it enters the view. */

  function revealAll(blocks) {
    blocks.forEach(function (block) {
      block.classList.remove('is-waiting');
    });
  }

  function watch(blocks, counters) {
    if (!motionAllowed() || !('IntersectionObserver' in window)) {
      return null;
    }
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        observer.unobserve(entry.target);
        if (entry.target.classList.contains('js-count')) {
          startCount(entry.target);
          return;
        }
        entry.target.classList.remove('is-waiting');
        entry.target.classList.add('is-in');
      });
    }, { threshold: 0 });
    counters.forEach(function (el) {
      observer.observe(el);
    });

    function arm() {
      if (!motionAllowed()) {
        return;
      }
      const fold = window.innerHeight + FOLD_MARGIN;
      blocks.forEach(function (block) {
        if (block.getBoundingClientRect().top > fold) {
          block.classList.add('is-waiting');
          observer.observe(block);
        }
      });
    }

    window.addEventListener('scroll', arm, { once: true, passive: true });
    return observer;
  }

  /* The logo comes from the bank's site. If it cannot load, the header shows the name as text
     in its place: Safari draws no alt text in a box this small. */
  function wireLogo() {
    const link = document.querySelector('.site-header > a');
    const logo = link.querySelector('img');

    function showName() {
      link.classList.add('is-logo-missing');
    }

    if (logo.complete && logo.naturalWidth === 0) {
      showName();
      return;
    }
    logo.addEventListener('error', showName);
  }

  function start() {
    root.classList.add('js');
    wireHeader();
    wireLogo();
    const blocks = Array.from(document.querySelectorAll('.reveal'));
    const counters = Array.from(document.querySelectorAll('.js-count'));
    const observer = watch(blocks, counters);

    /* Print, a capture or a switch to reduced motion: everything in its final state at once. */
    function settle() {
      if (observer !== null) {
        observer.disconnect();
      }
      finishCounts();
      revealAll(blocks);
    }

    window.addEventListener('beforeprint', settle);
    if (reduceQuery !== null && typeof reduceQuery.addEventListener === 'function') {
      reduceQuery.addEventListener('change', function () {
        if (reduceQuery.matches) {
          settle();
        }
      });
    }

    /* A count never stays half done when the tab goes to the background or the page is left. */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        finishCounts();
      }
    });
    window.addEventListener('pagehide', finishCounts);

    root.setAttribute('data-sisu-wired', '');
  }

  try {
    start();
  } catch {
    root.classList.remove('js');
  }
})();
