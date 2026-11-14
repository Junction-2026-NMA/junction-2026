/* Section 4, two small jobs.
   1. While the three panels stack (wide, tall screens with motion allowed; the media query below
   is the one in panels.css), the panel being covered recedes a little as the next one slides
   over it. This sets --cover, from 0 to 1, on each panel that has a panel after it: how far the
   next panel has travelled from this panel's bottom edge to its own resting place. panels.css
   turns --cover into a small scale and lift. Everywhere else, and if this script never runs,
   --cover stays at its CSS default 0 and the panels simply stack.
   2. It tells panels-motion.css when each half of a panel is well in view (see wireBuilds).
   Failure paths: no matchMedia or fewer than two panels, nothing happens; without
   IntersectionObserver the builds are not held and play as page.js reveals the panel. */
(function () {
  'use strict';

  const STACK = '(min-width: 1024px) and (min-height: 760px) and (prefers-reduced-motion: no-preference)';
  const LIFT = 12; /* px at --cover 1, the same lift as in panels.css */
  const QUARTER_MS = 900; /* a half a quarter in view builds after this long */
  const CAP_MS = 3000; /* and every half builds at most this long after its panel shows */

  if (typeof window.matchMedia !== 'function' || typeof window.requestAnimationFrame !== 'function') {
    return;
  }

  const stackQuery = window.matchMedia(STACK);
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const panels = Array.from(document.querySelectorAll('.panel-stack > .panel'));
  const covers = panels.map(function () {
    return 0;
  });
  let frame = 0;
  let active = false;

  if (panels.length < 2) {
    return;
  }

  function stacking() {
    return stackQuery.matches && !reduceQuery.matches;
  }

  function setCover(index, value) {
    if (covers[index] === value) {
      return;
    }
    covers[index] = value;
    if (value === 0) {
      panels[index].style.removeProperty('--cover');
    } else {
      panels[index].style.setProperty('--cover', String(value));
    }
  }

  /* Read every panel first, then write. The top is read without the lift this script added
     (the scale works from the top edge, so it does not move the top). */
  function update() {
    frame = 0;
    if (!active) {
      return;
    }
    const boxes = panels.map(function (panel, index) {
      return {
        top: panel.getBoundingClientRect().top + LIFT * covers[index],
        height: panel.offsetHeight,
        rest: parseFloat(window.getComputedStyle(panel).top) || 0,
      };
    });
    for (let index = 0; index < panels.length - 1; index += 1) {
      const next = boxes[index + 1];
      const edge = boxes[index].top + boxes[index].height;
      const travel = edge - next.rest;
      const progress = travel > 0 ? (edge - next.top) / travel : 0;
      setCover(index, Math.round(Math.min(1, Math.max(0, progress)) * 1000) / 1000);
    }
  }

  function schedule() {
    if (frame === 0) {
      frame = window.requestAnimationFrame(update);
    }
  }

  /* Listen to scrolling only while the panels stack; otherwise take every --cover back. */
  function sync() {
    const next = stacking();
    if (next === active) {
      if (active) {
        schedule();
      }
      return;
    }
    active = next;
    if (active) {
      window.addEventListener('scroll', schedule, { passive: true });
      schedule();
      return;
    }
    window.removeEventListener('scroll', schedule);
    if (frame !== 0) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
    panels.forEach(function (panel, index) {
      setCover(index, 0);
    });
  }

  /* The build inside each half of a panel (panels-motion.css) starts with page.js's is-in, which
     comes as soon as the panel's top edge shows. A reader who stops there would find the build
     over before the mock-up is in view, so each half's build is held, paused on its first frame,
     until that half is well in view: its top above 75% of the viewport height, or 900 ms after a
     quarter of it shows. Whatever happens, both halves go 3 s after the panel first shows, so
     every build still ends within 5 s of the reveal. The hold only applies once this is wired
     (panels-wired on the html element). */
  function wireBuilds() {
    if (!('IntersectionObserver' in window)) {
      return;
    }

    function release(half) {
      half.classList.add('is-near');
      nearObserver.unobserve(half);
      quarterObserver.unobserve(half);
    }

    function releaseLater(halves, ms) {
      window.setTimeout(function () {
        halves.forEach(release);
      }, ms);
    }

    const nearObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          release(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -25% 0px', threshold: 0 });

    const quarterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          quarterObserver.unobserve(entry.target);
          releaseLater([entry.target], QUARTER_MS);
        }
      });
    }, { threshold: 0.25 });

    const panelObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          panelObserver.unobserve(entry.target);
          releaseLater(Array.from(entry.target.children), CAP_MS);
        }
      });
    }, { threshold: 0 });

    panels.forEach(function (panel) {
      panelObserver.observe(panel);
      Array.from(panel.children).forEach(function (half) {
        nearObserver.observe(half);
        quarterObserver.observe(half);
      });
    });
    document.documentElement.classList.add('panels-wired');
  }

  window.addEventListener('resize', sync, { passive: true });
  if (typeof stackQuery.addEventListener === 'function') {
    stackQuery.addEventListener('change', sync);
    reduceQuery.addEventListener('change', sync);
  }
  sync();
  wireBuilds();
})();
