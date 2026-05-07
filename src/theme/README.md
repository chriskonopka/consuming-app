# `theme/`

## What belongs here

Theme provider, `useTheme()` hook, and the inline `<script>` in `index.html` that reads `localStorage.theme-preference` synchronously before first paint to prevent a flash of the wrong theme. Toggles `[data-theme="light" | "dark"]` on `<html>`. The actual color values live in `src/styles/global.css` per `web-branding.md`.

## What does not belong here

- Any other localStorage key (only `theme-preference` is sanctioned per `web-persistence.md`).
- Component styling — components consume CSS variables, not this module.
- The indexer's theme override props (deferred to v2 per REQUIREMENTS.md §10).

## Status

Scaffolded — implementation lands in slice 1.
