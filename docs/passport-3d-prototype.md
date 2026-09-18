# Passport 3D prototype

Route: `/passport-3d`. Original `/passport` and `/passport-c` views and styles were not modified.

## Implementation

- Three.js 0.186.0, lazy-loaded on this route. Procedural cover/spine/page geometry, existing character/stamp artwork rendered into canvas textures. No AI-generated replacement artwork or external 3D model required.
- Closed book: pointer/touch drag rotates horizontally with bounded vertical tilt. Reset button restores initial view.
- Open book: hinged cover animation, fixed reading camera; horizontal swipe or buttons change events with a turning leaf. Full event selector and eligibility filters use the existing authenticated Passport API.
- Current event only; locked/missed events do not reveal earned content. All authorized text, images, audio and special stamps remain available in accessible HTML details. Canvas text is a limited preview, not the authoritative complete text.
- Fullscreen API with viewport fallback; links to both earlier designs remain available.

## Resource policy

- Render on demand (input, texture completion, resize), plus finite animation frames. No idle animation loop.
- Pixel ratio capped at 1.5; no live shadows or post-processing.
- Cover/back/current spread texture set; replaced spread textures disposed. Image promise cache capped at 12 entries. Three resource disposal, observer/listener cleanup and async-result guards on navigation.
- WebGL initialization/context-loss failure offers normal reader route.

## Validation

Production build passes. Browser-only mock member data, Chromium software WebGL:
cover drag/reset, hinge opening/closing, 5 events, page turning, filters, locked detail gating, full text details, fullscreen, mobile width, route teardown, empty collection and context-loss fallback.
After 10 page changes, renderer reported 5 textures. Render frame counter stayed unchanged during a 500ms idle interval.

These are functional/resource checks, **not hardware FPS, heat, or battery measurements**. Safari/iOS and actual Mac/phone testing still needed before replacing production UX.

Screenshots (mock data): `design-previews/passport-3d-cover.png`, `passport-3d-open.png`, `passport-3d-rotated.png`, `passport-3d-mobile.png`.

Technical references: https://threejs.org/manual/en/rendering-on-demand.html and https://threejs.org/manual/en/cleanup.html
