/* Sisu landing page, sections 7 and 8.
   1. The five questions of "Good to know." open and close with a short height animation, and
      the sign turns at the first tap (the is-closing class). A mouse click, Enter and Space all
      reach the summary as one click. With reduced motion, or without the Web Animations API,
      the script steps aside and the native toggle runs. The first question is open in the
      HTML and shows its answer as part of the list's entrance; the first tap on any question
      ends that entrance (is-settled), so a reopened answer only fades in the way this script does.
   2. page.js reveals a block as soon as its first pixel shows. Two entrances are held (is-held
      pauses them in closing.css) until they can be seen: the question list until its top is a
      quarter of the way up the view, or the scrolling stops while it is in view; the closing
      banner until its demo button is inside the view, so its headline never shows without the
      button. Positions come from the layout, so a part that is still rising counts where it lands.
   The page is complete without this script: every <details> opens natively, nothing waits. */
(function () {
  'use strict';

  const DURATION = 220;
  const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const IDLE_MS = 160;
  const BUTTON_ROOM = 16;
  const items = Array.from(document.querySelectorAll('.faq-item'));
  const reduceQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function motionAllowed(el) {
    return reduceQuery !== null && !reduceQuery.matches && typeof el.animate === 'function';
  }

  /* The top of an element in the page, from layout offsets: transforms do not count. */
  function pageTop(el) {
    let top = 0;
    for (let node = el; node !== null; node = node.offsetParent) {
      top += node.offsetTop;
    }
    return top;
  }

  function holdEntrances() {
    if (reduceQuery === null || reduceQuery.matches) {
      return;
    }
    const list = document.querySelector('.faq-list');
    const banner = document.querySelector('.closing-block');
    const holds = [];
    let frame = 0;
    let idle = 0;

    /* Each test gets the scroll position and the height of the view. */
    if (list !== null) {
      holds.push({
        block: list,
        ready: function (scrollTop, height) {
          return pageTop(list) - scrollTop <= height * 0.75;
        },
        resting: function (scrollTop, height) {
          const top = pageTop(list) - scrollTop;
          return top < height && top + list.offsetHeight > 0;
        }
      });
    }
    if (banner !== null) {
      const button = banner.querySelector('.demo-button') || banner;
      const buttonSeen = function (scrollTop, height) {
        return pageTop(button) + button.offsetHeight - scrollTop <= height - BUTTON_ROOM;
      };
      holds.push({ block: banner, ready: buttonSeen, resting: buttonSeen });
    }

    function letGo(test) {
      const scrollTop = window.scrollY;
      const height = window.innerHeight;
      holds.filter(function (hold) {
        return hold[test](scrollTop, height);
      }).forEach(function (hold) {
        hold.block.classList.remove('is-held');
        holds.splice(holds.indexOf(hold), 1);
      });
      if (holds.length === 0) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        window.clearTimeout(idle);
      }
    }

    function onScroll() {
      if (frame === 0) {
        frame = window.requestAnimationFrame(function () {
          frame = 0;
          letGo('ready');
        });
      }
      window.clearTimeout(idle);
      idle = window.setTimeout(function () {
        letGo('resting');
      }, IDLE_MS);
    }

    holds.forEach(function (hold) {
      hold.block.classList.add('is-held');
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  function wire(details) {
    const summary = details.querySelector('summary');
    const answer = details.querySelector('.faq-answer');
    const list = details.closest('.faq-list');
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
      if (list !== null) {
        list.classList.add('is-settled');
      }
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
