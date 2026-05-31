# TASK: Build a high-quality, production-ready Shopify theme

Build a complete, modern **Shopify Online Store 2.0** theme from scratch in a new
folder named `theme/` in the current directory. Work autonomously — do not ask for
permission. Create every file, then verify the structure is complete before reporting.

## Quality bar (non-negotiable)

- **Online Store 2.0 architecture**: JSON templates + sections everywhere, so every
  page is editable in the Shopify theme editor (sections/blocks, not hardcoded).
- **Responsive & mobile-first**, looks premium on phone and desktop.
- **Accessible**: semantic HTML, alt text, focus states, ARIA where needed, WCAG AA contrast.
- **Fast**: minimal/no external JS libraries, lazy-loaded images, system fonts or a single
  webfont, CSS kept lean. No jQuery. Vanilla JS only, deferred.
- **Valid Liquid** that follows Shopify conventions and the Theme Check rules.
- **Customizable**: rich `config/settings_schema.json` (colors, typography, logo, spacing,
  social links) and per-section `{% schema %}` settings with sensible presets.

## Required folder structure (create all of it)

```
theme/
├── assets/
│   ├── base.css            # design tokens (CSS variables), layout, components
│   └── global.js           # cart drawer, menu toggle, deferred, vanilla JS
├── config/
│   ├── settings_schema.json
│   └── settings_data.json
├── layout/
│   └── theme.liquid        # <head>, header/footer renders, {{ content_for_layout }}
├── locales/
│   └── en.default.json
├── sections/
│   ├── header.liquid
│   ├── footer.liquid
│   ├── hero-banner.liquid
│   ├── featured-collection.liquid
│   ├── image-with-text.liquid
│   ├── rich-text.liquid
│   ├── testimonials.liquid
│   ├── newsletter.liquid
│   ├── main-product.liquid
│   ├── main-collection.liquid
│   ├── main-cart.liquid
│   └── main-page.liquid
├── snippets/
│   ├── product-card.liquid
│   ├── icon.liquid
│   └── price.liquid
└── templates/
    ├── index.json          # homepage: hero, featured-collection, image-with-text, testimonials, newsletter
    ├── product.json        # -> main-product
    ├── collection.json     # -> main-collection
    ├── cart.json           # -> main-cart
    ├── page.json           # -> main-page
    └── 404.json
```

## Design direction

Clean, modern, conversion-focused commerce look: generous whitespace, strong typographic
hierarchy, a single accent color driven by a theme setting, rounded cards, subtle hover
elevation, a sticky header with a cart count, and a slide-out cart drawer. Tasteful, not flashy.

## Steps

1. Create the full folder structure and every file above with real, working content.
2. Use CSS custom properties in `base.css` for all colors/spacing so settings can drive them.
3. Make each section have a proper `{% schema %}` with settings, blocks, and a `presets` entry
   so it can be added in the theme editor.
4. Wire `templates/*.json` to the matching sections.
5. After writing, run a structural self-check: list the tree and confirm every required file
   exists and each `.json` template references a section that exists.
6. If the `shopify` CLI is installed, run `shopify theme check ./theme` and fix any errors it
   reports; loop until clean. If it's not installed, skip that step and note it.
7. Report: the folder created, file count, and the exact next step to upload it
   (zip the `theme/` folder → Shopify admin → Online Store → Themes → Add theme → Upload zip).

Build the whole thing now, end to end, without stopping to ask.
