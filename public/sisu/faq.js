/* Sisu landing page, sections 7 and 8.
   1. The five questions of "Good to know." open and close with a short height animation, and
      the sign turns at the first tap (the is-closing class). A mouse click, Enter and Space all
      reach the summary as one click. With reduced motion, or without the Web Animations API,
      the script steps aside and the native toggle runs.
   2. page.js reveals a block as soon as its first pixel shows. The question list and the
      closing banner hold their entrance (is-held pauses it in closing.css) until their top is
      a quarter of the way up the view, so the parts arrive where the reader is looking. When
      the scrolling stops first, a block already in view is let go where it is.
   The page is complete without this script: every <details> opens natively, nothing waits. */
(function () {
  'use strict';

  const DURATION = 220;
  const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const items = Array.from(document.querySelectorAll('.faq-item'));
  const reduceQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function motionAllowed(el) {
    return reduceQuery !== null && !reduceQuery.matches && typeof el.animate === 'function';
  }

  function holdEntrances() {
    if (reduceQuery === null || reduceQuery.matches || !('IntersectionObserver' in window)) {
      return;
    }
    const blocks = Array.from(document.querySelectorAll('.faq-list, .closing-block'));
    const inView = new Set();
    let idle = 0;
    const zone = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          release(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -25% 0px' });
    const edge = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          inView.add(entry.target);
        } else {
          inView.delete(entry.target);
        }
      });
    });

    function isHeld(block) {
      return block.classList.contains('is-held');
    }

    function onScroll() {
      window.clearTimeout(idle);
      idle = window.setTimeout(function () {
        Array.from(inView).forEach(release);
      }, 160);
    }

    function release(block) {
      block.classList.remove('is-held');
      zone.unobserve(block);
      edge.unobserve(block);
      inView.delete(block);
      if (!blocks.some(isHeld)) {
        zone.disconnect();
        edge.disconnect();
        window.removeEventListener('scroll', onScroll);
      }
    }

    blocks.forEach(function (block) {
      zone.observe(block);
      edge.observe(block);
      block.classList.add('is-held');
    });
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function wire(details) {
    const summary = details.querySelector('summary');
    const answer = details.querySelector('.faq-answer');
    let sizing = null;
    let fading = null;

    if (summary === null) {
      return;
    }

    /* Stop any running animation and leave the question in its plain state. */
    function settle() {
      if (sizing !== null) {
        sizing.onfinish = null;
        sizing.cancel();
        sizing = null;
      }
      if (fading !== null) {
        fading.cancel();
        fading = null;
      }
      details.classList.remove('is-closing');
      details.style.overflow = '';
    }

    function run(fromHeight, toHeight, opening) {
      details.style.overflow = 'hidden';
      sizing = details.animate({ height: [fromHeight + 'px', toHeight + 'px'] }, { duration: DURATION, easing: EASING, fill: 'forwards' });
      sizing.onfinish = function () {
        if (!opening) {
          details.open = false;
        }
        settle();
      };
      if (opening && answer !== null) {
        fading = answer.animate({ opacity: [0, 1] }, { duration: DURATION, easing: EASING });
      }
    }

    summary.addEventListener('click', function (event) {
      if (!motionAllowed(details)) {
        settle();
        return;
      }
      event.preventDefault();
      const fromHeight = details.getBoundingClientRect().height;
      const closing = details.open && !details.classList.contains('is-closing');
      settle();
      try {
        if (closing) {
          details.classList.add('is-closing');
          run(fromHeight, summary.getBoundingClientRect().height, false);
        } else {
          details.open = true;
          run(fromHeight, details.getBoundingClientRect().height, true);
        }
      } catch {
        /* The animation could not start: toggle plainly, as the browser would have. */
        settle();
        details.open = !closing;
      }
    });
  }

  items.forEach(wire);
  holdEntrances();
})();
