# Myreliablecleanup — Website

Conversion-focused marketing site for **Myreliablecleanup**, a junk removal,
property cleanout, and debris hauling business.

- **Phone:** [+1 (940) 372-1737](tel:+19403721737)
- **Email:** blankenship668@gmail.com

## Stack

Vanilla HTML, CSS, and JavaScript — no build step, no dependencies, no external
APIs. Open `index.html` in a browser, or serve the folder with any static host.

```bash
python3 -m http.server 8000
```

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Hero + inline quote form, services overview, process, testimonials, FAQ |
| `services.html` | Detailed breakdown of all six services, plus what we can/can't haul |
| `about.html` | Story, values, who we help, service area |
| `reviews.html` | Full testimonials grid and review themes |
| `contact.html` | Contact details, full quote form, contact FAQ |

## Structure

```
index.html, services.html, about.html, reviews.html, contact.html
css/styles.css      Design tokens + all component styles
js/main.js          Nav, FAQ accordion, form validation, scroll reveal
assets/favicon.svg  Favicon / logo mark
robots.txt, sitemap.xml
```

## Notable details

- **Click-to-call** in the top bar, header, hero, every CTA band, and a sticky
  bottom call bar on mobile.
- **Quote form** validates in the browser, then hands the message to the
  visitor's own email client via a `mailto:` link addressed to the business.
  There is no backend and no third-party form service, so no keys or
  environment variables are required.
- Service cards link to `contact.html?service=…`, which preselects the matching
  option in the quote form.
- Semantic HTML, skip link, ARIA labelling on the nav toggle and form errors,
  and `prefers-reduced-motion` support.
- Per-page meta description/keywords, Open Graph and Twitter card tags, and
  `LocalBusiness` JSON-LD on the homepage.

## Images

No source photography was supplied for this build, so the site deliberately uses
inline SVG iconography and CSS gradients instead of photographs. No placeholder
or hotlinked stock images are referenced — every visual asset is local and real.
Drop authentic photos of the crew, trucks, and completed jobs in `assets/` and
reference them when they become available.
