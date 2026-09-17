# Passport C — Memory Atelier comparison

Implemented 2026-09-17 as an independent comparison route.

- New route: `/passport-c` (`src/views/PassportAtelier.jsx`, scoped `passport-atelier.css`).
- Original route: `/passport`, unchanged in this implementation. No global navigation replacement or database/schema changes.
- Same authenticated `/api/passport`, server-owned earnings, event artwork mapping and special stamp components.
- One event per spread; latest earned event selected initially. Mobile stacks its two pages. Filter, month tabs, event select, swipe and previous/next navigate the same collection.
- Only authorized earned-event unlocks are displayed. Existing unlock types image/text/audio supported. No synthetic event photo, no claim of a personal or group album that the API does not yet provide.
- Where no image is available, show a decorative memory envelope. Existing event text/audio and special stamps remain available.
- Event sharing reuses the existing PNG exporter with only the selected earned event and its extras. It does not include personal photos and does not export a screenshot of the scrapbook.
- Friend invite link/count and sticker eligibility notice preserved using existing data.
- Comparison link on C returns to the original route; original navigation continues to lead to original Passport.

Validation: production build; browser-only fixtures (no database modifications), 5 events, latest-earned selection, month/filter/event selection, event PNG, stamp details, invite copy, image/audio/text unlocks, empty/error/retry, mobile 390/320 overflow, return to original page. Original Passport JSX/CSS/route hashes unchanged.

Previews: `design-previews/passport-c-desktop-implemented.png`, `passport-c-mobile-390.png`, `passport-c-mobile-320.png` use mock member/event data, not actual member screenshots.

Not yet implemented: multi-photo/private photo-pair albums, photo-inclusive share composition, real-device performance measurement. These require separate verification of backend support and privacy/authorization.

## Viewport reader update

- Compact heading; available player height calculated from viewport and its document position. Book width is constrained by height as well as width; no whole-UI scaling.
- Native browser fullscreen on the page root so stamp/photo/share dialogs stay available. Unsupported/denied fullscreen falls back to fixed viewport reading mode; Escape and scroll restoration supported.
- Narrow screens show one paper at a time. Memory, note chunks, captions, audio and pairs of special stamps have separate inner-page controls. Arrow keys work within the player; event controls remain distinct.
- Long notes preserve all text across pages, bounded by character and explicit newline counts. Long event titles are limited to two lines in the overview; full title remains in stamp detail.
- Measured browser fixtures at 1280×720, 1440×800, 390×844, 320×700: complete book + both navigation rows within viewport; no paper overflow across long text and seven special stamps. Native fullscreen and fallback Escape/scroll restoration pass. Original Passport files remain unchanged.
- Latest screenshots: `design-previews/passport-fit-1280.png`, `passport-fit-1440.png`, and `passport-fullscreen-1280.png` (mock member data).
