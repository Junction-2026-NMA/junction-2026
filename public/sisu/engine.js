/* Sisu landing page: the architecture map.
   The block is complete without this script: nine steps listed, every part explained, the map
   linking to the explanations. This script turns it into a player and a picker:
   one step at a time with the parts of that step lit, and one explanation open.
   Failure path: if the wiring throws, the is-live class is taken back and the full lists return.
   The turn plays once by itself when the block comes into view, unless motion is reduced.
   Any press stops it. */
(function () {
  'use strict';

  const STEP_MS = 3400;
  const FIRST_NODE = 'orch';
  const arch = document.getElementById('arch');
  if (!arch) {
    return;
  }

  const nodes = Array.from(arch.querySelectorAll('.node'));
  const details = Array.from(arch.querySelectorAll('.node-detail'));
  const steps = Array.from(arch.querySelectorAll('.turn-step'));
  const bar = arch.querySelector('.turn-bar');
  const playButton = arch.querySelector('.turn-play');
  const backButton = arch.querySelector('.turn-back');
  const nextButton = arch.querySelector('.turn-next');
  const count = arch.querySelector('.turn-count');
  const top = arch.querySelector('.arch-top');
  const side = arch.querySelector('.arch-side');
  const panel = arch.querySelector('.node-details');
  const canMatch = typeof window.matchMedia === 'function';
  const wideQuery = canMatch ? window.matchMedia('(min-width: 1024px)') : null;
  const reduceQuery = canMatch ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const lastStep = steps.length - 1;

  let current = 0;
  let chosen = null;
  let timer = null;
  let touched = false;
  let announcer = null;

  function isWide() {
    return wideQuery !== null && wideQuery.matches;
  }

  function motionAllowed() {
    return reduceQuery !== null && !reduceQuery.matches;
  }

  /* The explanation sits beside the map on a wide screen, and under the chosen part's layer on a phone. */
  function placePanel() {
    const layer = chosen ? chosen.closest('.layer') : null;
    if (isWide() || !layer) {
      side.appendChild(panel);
      return;
    }
    layer.after(panel);
  }

  function choose(id, byUser) {
    const next = nodes.find(function (node) {
      return node.dataset.node === id;
    });
    if (!next) {
      return;
    }
    chosen = next;
    nodes.forEach(function (node) {
      if (node === next) {
        node.setAttribute('aria-current', 'true');
      } else {
        node.removeAttribute('aria-current');
      }
    });
    details.forEach(function (detail) {
      detail.classList.toggle('is-open', detail.id === 'n-' + id);
    });
    placePanel();
    if (byUser && !isWide()) {
      panel.scrollIntoView({ block: 'nearest', behavior: motionAllowed() ? 'smooth' : 'auto' });
    }
  }

  function showStep(index, announce) {
    current = Math.max(0, Math.min(lastStep, index));
    const step = steps[current];
    const lit = (step.dataset.nodes || '').split(' ');
    steps.forEach(function (item, i) {
      item.classList.toggle('is-current', i === current);
    });
    nodes.forEach(function (node) {
      node.classList.toggle('is-lit', lit.indexOf(node.dataset.node) !== -1);
    });
    count.textContent = 'Step ' + (current + 1) + ' of ' + steps.length;
    backButton.disabled = current === 0;
    nextButton.disabled = current === lastStep;
    if (announce) {
      announcer.textContent = 'Step ' + (current + 1) + '. ' + step.querySelector('p').textContent;
    }
  }

  function stop() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    playButton.textContent = current === lastStep ? 'Play again' : 'Play the turn';
  }

  function play() {
    if (current === lastStep) {
      showStep(0, false);
    }
    playButton.textContent = 'Pause';
    timer = window.setInterval(function () {
      if (current === lastStep) {
        stop();
        return;
      }
      showStep(current + 1, false);
      if (current === lastStep) {
        stop();
      }
    }, STEP_MS);
  }

  function byHand(action) {
    return function (event) {
      touched = true;
      action(event);
    };
  }

  function wire() {
    announcer = document.createElement('p');
    announcer.className = 'vh';
    announcer.setAttribute('aria-live', 'polite');
    top.appendChild(announcer);

    playButton.addEventListener('click', byHand(function () {
      if (timer !== null) {
        stop();
        return;
      }
      play();
    }));
    backButton.addEventListener('click', byHand(function () {
      stop();
      showStep(current - 1, true);
      stop();
    }));
    nextButton.addEventListener('click', byHand(function () {
      stop();
      showStep(current + 1, true);
      stop();
    }));
    nodes.forEach(function (node) {
      node.addEventListener('click', byHand(function (event) {
        event.preventDefault();
        choose(node.dataset.node, true);
      }));
    });

    if (wideQuery !== null) {
      wideQuery.addEventListener('change', placePanel);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stop();
      }
    });

    arch.classList.add('is-live');
    bar.hidden = false;
    showStep(0, false);
    stop();
    const fromAddress = window.location.hash.indexOf('#n-') === 0 ? window.location.hash.slice(3) : '';
    choose(FIRST_NODE, false);
    if (fromAddress) {
      choose(fromAddress, false);
    }

    /* Play once when the top of the block is in view, unless someone has already pressed something. */
    if (!motionAllowed() || !('IntersectionObserver' in window)) {
      return;
    }
    const observer = new IntersectionObserver(function (entries) {
      const seen = entries.some(function (entry) {
        return entry.isIntersecting;
      });
      if (!seen) {
        return;
      }
      observer.disconnect();
      if (!touched && timer === null) {
        play();
      }
    }, { threshold: 0.6 });
    observer.observe(top);
  }

  try {
    wire();
  } catch (error) {
    arch.classList.remove('is-live');
    if (bar) {
      bar.hidden = true;
    }
    console.error('Sisu architecture map: wiring failed, showing the full lists.', error);
  }
})();
