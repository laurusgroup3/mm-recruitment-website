// MM Recruitment Ltd - site-wide behaviour. No framework, no build
// step - plain, dependency-free JS matching this site's static
// Cloudflare Pages deployment. Independent copy of the mobile nav-
// toggle pattern used elsewhere in the Laurus Group ecosystem, not a
// shared import - this project has its own repository and its own
// brand, deliberately decoupled from Laurus Recruitment's codebase.
(function () {
  'use strict';

  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    var closeNav = function () {
      nav.classList.remove('is-open');
      toggle.classList.remove('is-active');
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('is-open');
      toggle.classList.toggle('is-active', isOpen);
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeNav);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });
  }

  // -------------------------------------------------------------------
  // Enquiry forms (Contact, Employer enquiry) - a REAL submission path,
  // not a mock: posts to /api/send-enquiry (functions/api/send-enquiry.js),
  // which relays the message by email. Honest about every outcome - if
  // the email provider isn't configured yet in this environment, the
  // Function says so plainly rather than pretending to have sent it.
  // Never used for candidate/employer PORTAL sign-in, which stays
  // explicitly disabled in this phase - see candidate-portal.html/
  // employer-portal.html.
  // -------------------------------------------------------------------
  document.querySelectorAll('form[data-enquiry-form]').forEach(function (form) {
    var submitBtn = form.querySelector('button[type="submit"]');
    var messageEl = form.querySelector('.form-message');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!messageEl) return;
      messageEl.textContent = '';
      messageEl.classList.remove('is-error', 'is-success');

      var formType = form.getAttribute('data-enquiry-form');
      var data = {};
      new FormData(form).forEach(function (value, key) { data[key] = value; });

      if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('is-loading'); }
      messageEl.textContent = 'Sending…';

      fetch('/api/send-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formType: formType, fields: data }),
      })
        .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
        .then(function (result) {
          if (result.ok && result.body && result.body.ok) {
            form.reset();
            messageEl.textContent = "Thank you - your message has been sent. We'll be in touch soon.";
            messageEl.classList.add('is-success');
          } else {
            messageEl.textContent = (result.body && result.body.message) || 'Something went wrong - please try again, or email us directly.';
            messageEl.classList.add('is-error');
          }
        })
        .catch(function () {
          messageEl.textContent = 'Could not send your message - please check your connection and try again.';
          messageEl.classList.add('is-error');
        })
        .finally(function () {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('is-loading'); }
        });
    });
  });
})();
