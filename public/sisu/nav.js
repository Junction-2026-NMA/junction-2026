/* Sisu landing page: the "Katso lisää" menu of the bank header.
   From 1024px the navigation links that do not fit on one row move, in order, into a small
   list under a "Katso lisää" pill, as on the bank's own site. Below 1024px every link is a
   row of the phone menu. Without this script the links simply wrap onto further rows. */
(function () {
  'use strict';

  const header = document.querySelector('.site-header');
  const list = header === null ? null : header.querySelector('.nav-list');
  const chevron = header === null ? null : header.querySelector('.segment-button svg');
  if (list === null || chevron === null || typeof window.matchMedia !== 'function') {
    return;
  }

  const wideQuery = window.matchMedia('(min-width: 1024px)');
  const links = Array.from(list.children);
  const more = document.createElement('li');
  const button = document.createElement('button');
  const overflow = document.createElement('ul');
  let frame = 0;

  function setOpen(open) {
    more.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function fits() {
    return list.scrollWidth <= list.clientWidth;
  }

  /* Put every link back in its row. Then, while the row is too long, move the last link
     into the list under the pill. The first link always stays in the row. */
  function fit() {
    setOpen(false);
    more.remove();
    links.forEach(function (link) {
      list.appendChild(link);
    });
    list.classList.toggle('is-fitted', wideQuery.matches);
    if (!wideQuery.matches || fits()) {
      return;
    }
    list.appendChild(more);
    for (let i = links.length - 1; i > 0 && !fits(); i -= 1) {
      overflow.insertBefore(links[i], overflow.firstChild);
    }
  }

  function fitSoon() {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(fit);
  }

  more.className = 'nav-more';
  button.className = 'more-button';
  button.type = 'button';
  overflow.className = 'more-list';
  overflow.id = 'lisaa-valikko';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', overflow.id);
  button.append('Katso lisää', chevron.cloneNode(true));
  more.append(button, overflow);

  button.addEventListener('click', function () {
    setOpen(!more.classList.contains('is-open'));
  });

  /* The list lies over the page: Escape, a click outside or a focus move outside closes it. */
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && more.classList.contains('is-open')) {
      setOpen(false);
      button.focus();
    }
  });

  document.addEventListener('click', function (event) {
    if (!more.contains(event.target)) {
      setOpen(false);
    }
  });

  more.addEventListener('focusout', function (event) {
    const next = event.relatedTarget;
    if (next instanceof Node && !more.contains(next)) {
      setOpen(false);
    }
  });

  /* Widths change with the window and when the web font arrives. */
  window.addEventListener('resize', fitSoon);
  if (document.fonts !== undefined && document.fonts.ready !== undefined) {
    document.fonts.ready.then(fitSoon);
  }
  fit();
})();
