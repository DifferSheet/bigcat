# Passport event memories

One event occupies two consecutive pages, not a grid of unrelated stamps.
Desktop shows both; mobile navigates stamp/note → photographs → next event.
Keep the live paper nodes through the opening animation. Do not clone/swap them.

## Staff workflow

Edit event → Passport → สมุดความทรงจำ. Choose a stable layout (auto, warm,
playful, special, merit), author (Boota/Nobi), handwritten-note photo, transcript,
group photograph and caption. Save the event as usual. Images should be straight,
evenly lit; transcripts provide readable text on small screens. Group and note
images are ordinary public uploads: never put a private portrait there.

For private portraits, save/create the event first. Enter the member ID from the
members admin page, verify the returned name, then explicitly confirm uploading.
The member must already have a checkin/merit stamp. Portrait actions save separately
from the event form. Removing a portrait revokes its route; original files remain
on disk for recoverability (no automatic deletion).

## Data and privacy

Common fields live in existing events.config.memory:
`{layout, author, noteImage, noteText, groupImage, caption}`.
The whitelist in applyPassportFiles excludes private fields from event config.
The stamp's existing meta.passportPortrait stores the private filename. No schema
migration is needed. Other stamp metadata is preserved using JSON_SET/JSON_REMOVE.
API /passport exposes only the signed-in member's portrait route, after the event.
GET /api/passport/:slug/portrait independently verifies membership, stamp, event
visibility and timing. Its response is private/no-store, and cannot use a caller's
user ID to select someone else's photograph.

Private files are in **server/private-passport**, outside public /uploads. Preserve
this directory across deployment and include it in access-controlled backups.
Do not add a static route or public CDN mapping for this directory. The API process
needs write permission there. Restart the API after deploying route changes.

Existing unlock image/text is a fallback when memory fields are absent. Explicitly
empty fields disable that fallback. Existing audio/extras stay in stamp details.
No photographs are fabricated for events without actual media: display a pending
note, while keeping the earned stamp visible immediately.

## Layout and sharing

Warm: group-first. Playful: two gently rotated photographs. Special: portrait-first
in visual size. Merit: straight alignment and restrained gold detail. Auto uses
event type and available photographs; never randomizes. A single group photo fills
the album without an empty portrait slot. Images use contain, not face-cropping.
Tape stays at the border. Full images open through accessible links.

Sharing produces a downloadable PNG locally, never posts automatically. The
portrait checkbox is off initially, and changing it invalidates the previous
export. The existing full-passport export remains stamp-only.

## Verification

Use mocked API fixtures for layout, paging and export tests; never fabricate
stamps or upload demo photographs to the live database. Test 0/1/many events,
group-only, portrait-only, both, pending, not-earned, and mobile page 1/2 → 2/2.
