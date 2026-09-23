/* =========================================================
   Myreliablecleanup — Site scripts
   Vanilla JS. No external dependencies, no network calls.
   ========================================================= */
(function () {
  'use strict';

  var BUSINESS_EMAIL = 'blankenship668@gmail.com';

  /* ---------------------------------------------------
     1. Mobile navigation
     --------------------------------------------------- */
  function initNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    function close() {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Close after tapping a link (same-page anchors especially)
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        close();
        toggle.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(e.target) || toggle.contains(e.target)) return;
      close();
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 920) close();
    });
  }

  /* ---------------------------------------------------
     2. Current year in footers
     --------------------------------------------------- */
  function initYear() {
    var nodes = document.querySelectorAll('[data-year]');
    var year = String(new Date().getFullYear());
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = year;
  }

  /* ---------------------------------------------------
     3. Reveal-on-scroll
     --------------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('is-visible');
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------
     4. FAQ — keep one answer open at a time per group
     --------------------------------------------------- */
  function initFaq() {
    var groups = document.querySelectorAll('[data-faq]');
    groups.forEach(function (group) {
      var items = group.querySelectorAll('details.faq__item');
      items.forEach(function (item) {
        item.addEventListener('toggle', function () {
          if (!item.open) return;
          items.forEach(function (other) {
            if (other !== item) other.open = false;
          });
        });
      });
    });
  }

  /* ---------------------------------------------------
     5. Quote / contact form
     Validates in the browser, then hands the message to the
     visitor's own email client via a mailto: link. No server,
     no third-party API, no environment variables.
     --------------------------------------------------- */
  function initForms() {
    var forms = document.querySelectorAll('form[data-quote-form]');
    if (!forms.length) return;

    forms.forEach(function (form) {
      var status = form.querySelector('.form-status');

      function setError(field, message) {
        var wrap = field.closest('.field');
        var slot = wrap ? wrap.querySelector('.field__error') : null;
        if (message) {
          field.setAttribute('aria-invalid', 'true');
          if (slot) slot.textContent = message;
        } else {
          field.removeAttribute('aria-invalid');
          if (slot) slot.textContent = '';
        }
      }

      function validEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
      }

      function validPhone(value) {
        var digits = value.replace(/\D/g, '');
        return digits.length >= 10 && digits.length <= 15;
      }

      function validate() {
        var firstBad = null;

        // Optional fields still have to be well-formed if the visitor filled them in.
        var optional = form.querySelectorAll('input[type="email"]:not([data-required]), input[type="tel"]:not([data-required])');
        optional.forEach(function (field) {
          var value = (field.value || '').trim();
          var message = '';
          if (value && field.type === 'email' && !validEmail(value)) {
            message = 'Please enter a valid email address.';
          } else if (value && field.type === 'tel' && !validPhone(value)) {
            message = 'Please enter a valid phone number.';
          }
          setError(field, message);
          if (message && !firstBad) firstBad = field;
        });

        var required = form.querySelectorAll('[data-required]');
        required.forEach(function (field) {
          var value = (field.value || '').trim();
          var message = '';

          if (!value) {
            message = 'This field is required.';
          } else if (field.type === 'email' && !validEmail(value)) {
            message = 'Please enter a valid email address.';
          } else if (field.type === 'tel' && !validPhone(value)) {
            message = 'Please enter a valid phone number.';
          } else if (field.name === 'name' && value.length < 2) {
            message = 'Please enter your full name.';
          } else if (field.name === 'details' && value.length < 10) {
            message = 'Please tell us a little more about the job.';
          }

          setError(field, message);
          if (message && !firstBad) firstBad = field;
        });

        return firstBad;
      }

      // Clear an error as soon as the visitor starts fixing it
      form.addEventListener('input', function (e) {
        if (e.target.hasAttribute('data-required') && e.target.getAttribute('aria-invalid')) {
          setError(e.target, '');
        }
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Honeypot: silently succeed for bots, send nothing.
        var hp = form.querySelector('[name="company_website"]');
        if (hp && hp.value) return;

        var firstBad = validate();
        if (firstBad) {
          if (status) {
            status.className = 'form-status is-error';
            status.textContent = 'Please correct the highlighted fields and try again.';
          }
          firstBad.focus();
          return;
        }

        var get = function (n) {
          var el = form.querySelector('[name="' + n + '"]');
          return el ? (el.value || '').trim() : '';
        };

        var name = get('name');
        var phone = get('phone');
        var email = get('email');
        var service = get('service');
        var location = get('location');
        var timing = get('timing');
        var details = get('details');

        var subject = 'Quote request' + (service ? ' — ' + service : '') + ' — ' + (name || 'Website enquiry');

        var lines = [
          'New quote request from the Myreliablecleanup website',
          '',
          'Name: ' + name,
          'Phone: ' + phone,
          'Email: ' + (email || 'Not provided'),
          'Service needed: ' + (service || 'Not specified'),
          'Job location: ' + (location || 'Not provided'),
          'Preferred timing: ' + (timing || 'Not specified'),
          '',
          'Job details:',
          details
        ];

        var href = 'mailto:' + BUSINESS_EMAIL +
          '?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(lines.join('\n'));

        window.location.href = href;

        if (status) {
          status.className = 'form-status is-success';
          status.innerHTML =
            'Thanks, ' + escapeHtml(name.split(' ')[0] || 'there') + '! Your email app should now be open with ' +
            'your request ready to send &mdash; just hit send. In a hurry? Call us directly at ' +
            '<a href="tel:+19403721737">(940) 372-1737</a>.';
          status.setAttribute('tabindex', '-1');
          status.focus();
        }

        form.reset();
      });
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------------------------------------------
     6. Prefill the quote form from ?service= links
     --------------------------------------------------- */
  function initPrefill() {
    var params = new URLSearchParams(window.location.search);
    var service = params.get('service');
    if (!service) return;

    var select = document.querySelector('form[data-quote-form] select[name="service"]');
    if (!select) return;

    var options = select.options;
    for (var i = 0; i < options.length; i++) {
      if (options[i].value.toLowerCase() === service.toLowerCase()) {
        select.selectedIndex = i;
        break;
      }
    }
  }

  /* ---------------------------------------------------
     Boot
     --------------------------------------------------- */
  function boot() {
    initNav();
    initYear();
    initReveal();
    initFaq();
    initForms();
    initPrefill();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
