/* Section 4, three jobs on top of panels that are complete without them.
   1. The deck (wide screens of a usual height with motion allowed; DECK is the media query of
   panels.css). The stacking itself is plain CSS. This sets --depth on each covered panel, how far
   the panels after it have slid over it (0 to 2), which panels.css turns into a small recede, and
   raises --deck-h when a panel's content needs more than the CSS height.
   2. The builds of panels-motion.css. Each half of a panel waits on its first frame until it gets
   is-live. In the deck both halves go live when the panel has settled at its rest, or when the
   reader stops scrolling with nearly all of the panel in view and uncovered. A panel that starts
   to be covered is finished at once, so nothing builds underneath the next panel. Outside the
   deck a half goes live when it is mostly in view: its top above 60% of the viewport height.
   3. The €64 of panel 1 counts up from 0 as its half goes live (data-count-up holds the ms).
   Failure paths: without matchMedia, requestAnimationFrame or IntersectionObserver, or without
   panels, nothing is held and nothing counts; the builds then play as page.js reveals a panel. */
(function () {
  'use strict';

  const DECK = '(min-width: 1024px) and (min-height: 760px) and (max-height: 1160px) and (prefers-reduced-motion: no-preference)';
  const BUILD_MS = 120; /* the --build delay of panels-motion.css */
  const IDLE_MS = 300; /* no scrolling for this long counts as the reader stopping */
  const IN_VIEW = 0.85; /* the share of a panel in view and uncovered that a stop needs */

  if (typeof window.matchMedia !== 'function' || typeof window.requestAnimationFrame !== 'function' ||
    !('IntersectionObserver' in window)) {
    return;
  }

  const stack = document.querySelector('.panel-stack');
  const panels = stack === null ? [] : Array.from(stack.querySelectorAll('.panel'));
  if (panels.length === 0) {
    return;
  }

  const deckQuery = window.matchMedia(DECK);
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const halves = panels.reduce(function (list, panel) {
    return list.concat(Array.from(panel.children));
  }, []);
  const rests = panels.map(function (panel, index) {
    return 24 * (index + 1);
  });
  const depths = panels.map(function () {
    return 0;
  });
  const finished = panels.map(function () {
    return false;
  });
  let deckOn = false;
  let frame = 0;
  let idleTimer = 0;
  let stopCount = null;

  /* Outside the deck: a half builds when it is mostly in view. */
  const nearObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && !deckOn) {
        goLive(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -40% 0px', threshold: 0 });

  function clamp(value) {
    return Math.min(1, Math.max(0, value));
  }

  /* The count: the HTML holds the final text. While it counts, screen readers get a hidden copy of
     the final text, and whatever happens it ends on that text. */
  function countUp(el) {
    const finalText = el.textContent;
    const parts = /^(\D*)(\d+)(\D*)$/.exec(finalText);
    if (parts === null || el.children.length > 0 || reduceQuery.matches || document.hidden || stopCount !== null) {
      return;
    }
    const target = Number(parts[2]);
    const countMs = Number(el.getAttribute('data-count-up')) || 800;
    const startAt = window.performance.now() + BUILD_MS;
    const spoken = document.createElement('span');
    let tick = 0;
    let timer = 0;

    function finish() {
      window.cancelAnimationFrame(tick);
      window.clearTimeout(timer);
      el.textContent = finalText;
      el.removeAttribute('aria-hidden');
      spoken.remove();
      stopCount = null;
    }

    function step(now) {
      const progress = clamp((now - startAt) / countMs);
      if (progress >= 1) {
        finish();
        return;
      }
      el.textContent = parts[1] + Math.round(target * (1 - Math.pow(1 - progress, 3))) + parts[3];
      tick = window.requestAnimationFrame(step);
    }

    spoken.className = 'vh';
    spoken.textContent = finalText;
    el.setAttribute('aria-hidden', 'true');
    el.insertAdjacentElement('afterend', spoken);
    stopCount = finish;
    tick = window.requestAnimationFrame(step);
    timer = window.setTimeout(finish, BUILD_MS + countMs + 400);
  }

  function endCount() {
    if (stopCount !== null) {
      stopCount();
    }
  }

  /* A half goes live once. A count starts only in a panel page.js has revealed, as its build. */
  function goLive(half) {
    if (half.classList.contains('is-live')) {
      return;
    }
    half.classList.add('is-live');
    nearObserver.unobserve(half);
    const counter = half.querySelector('[data-count-up]');
    if (counter !== null && half.parentElement.classList.contains('is-in')) {
      countUp(counter);
    }
  }

  function panelLive(index) {
    Array.from(panels[index].children).forEach(goLive);
  }

  /* A panel being covered: its build jumps to the end, the count to its final text. A panel not
     revealed yet keeps waiting instead (under the next panel only its top edge shows). */
  function finish(index) {
    if (finished[index] || !panels[index].classList.contains('is-in')) {
      return;
    }
    finished[index] = true;
    panelLive(index);
    if (panels[index].querySelector('[data-count-up]') !== null) {
      endCount();
    }
    if (typeof panels[index].getAnimations === 'function') {
      panels[index].getAnimations({ subtree: true }).forEach(function (animation) {
        animation.finish();
      });
    }
  }

  function setDepth(index, value) {
    if (depths[index] === value) {
      return;
    }
    depths[index] = value;
    if (value === 0) {
      panels[index].style.removeProperty('--depth');
    } else {
      panels[index].style.setProperty('--depth', String(value));
    }
  }

  function boxes() {
    return panels.map(function (panel) {
      const top = panel.getBoundingClientRect().top;
      return { top: top, bottom: top + panel.offsetHeight };
    });
  }

  /* Cover: how far the next panel has come from this panel's bottom edge to its own rest. The
     scale of a covered panel works from its top edge, so it does not move the top. */
  function update() {
    frame = 0;
    if (!deckOn) {
      return;
    }
    const box = boxes();
    const covers = box.map(function (item, index) {
      const next = box[index + 1];
      const travel = next === undefined ? 0 : item.bottom - rests[index + 1];
      return travel > 0 ? clamp((item.bottom - next.top) / travel) : 0;
    });
    let depth = 0;
    for (let index = panels.length - 1; index >= 0; index -= 1) {
      depth += covers[index];
      setDepth(index, Math.round(depth * 1000) / 1000);
      if (covers[index] > 0) {
        finish(index);
      } else if (box[index].top <= rests[index] + 1 && box[index].bottom > 0) {
        panelLive(index);
      }
    }
  }

  /* The reader has stopped: a panel nearly all in view and not covered builds where it is. */
  function onIdle() {
    idleTimer = 0;
    if (!deckOn) {
      return;
    }
    const view = window.innerHeight;
    const box = boxes();
    box.forEach(function (item, index) {
      const next = box[index + 1];
      const end = Math.min(item.bottom, view, next !== undefined && next.top < item.bottom ? next.top : Infinity);
      if (end - Math.max(item.top, 0) >= IN_VIEW * (item.bottom - item.top)) {
        panelLive(index);
      }
    });
  }

  function onScroll() {
    if (frame === 0) {
      frame = window.requestAnimationFrame(update);
    }
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(onIdle, IDLE_MS);
  }

  /* Every panel as tall as the tallest one, and where each one rests (--rest of its slot). */
  function fitDeck() {
    stack.style.removeProperty('--deck-h');
    if (!deckOn) {
      return;
    }
    const base = parseFloat(window.getComputedStyle(stack).getPropertyValue('--deck-h')) || 0;
    const tallest = Math.max.apply(null, panels.map(function (panel) {
      return panel.offsetHeight;
    }));
    if (tallest > base + 1) {
      stack.style.setProperty('--deck-h', tallest + 'px');
    }
    panels.forEach(function (panel, index) {
      const rest = parseFloat(window.getComputedStyle(panel.parentElement).getPropertyValue('--rest'));
      rests[index] = Number.isFinite(rest) ? rest : 24 * (index + 1);
    });
  }

  /* Into the deck: listen to scrolling. Out of it: no recede, and every half still waiting is
     watched again, so one already in view builds now. */
  function sync() {
    const next = deckQuery.matches;
    if (next !== deckOn) {
      deckOn = next;
      if (deckOn) {
        window.addEventListener('scroll', onScroll, { passive: true });
      } else {
        window.removeEventListener('scroll', onScroll);
        panels.forEach(function (panel, index) {
          setDepth(index, 0);
        });
        halves.forEach(function (half) {
          if (!half.classList.contains('is-live')) {
            nearObserver.unobserve(half);
            nearObserver.observe(half);
          }
        });
      }
    }
    fitDeck();
    if (deckOn) {
      onScroll();
    }
  }

  halves.forEach(function (half) {
    nearObserver.observe(half);
  });
  document.documentElement.classList.add('panels-wired');
  window.addEventListener('resize', sync, { passive: true });
  if (typeof deckQuery.addEventListener === 'function') {
    deckQuery.addEventListener('change', sync);
    reduceQuery.addEventListener('change', function () {
      if (reduceQuery.matches) {
        endCount();
      }
    });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      endCount();
    }
  });
  window.addEventListener('beforeprint', endCount);
  window.addEventListener('pagehide', endCount);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(sync);
  }
  sync();
})();
