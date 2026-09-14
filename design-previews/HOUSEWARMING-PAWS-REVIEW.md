# Paw correction — completed by authorized direct retouch

The user approved direct raster retouch after the generated candidates failed digit-count review. `retouch-paws.py` uses Pillow and NumPy to heal extra digit pads, clone one missing pad, and transfer Nobi's curved eyelid/open smile to the portrait image. No new image generation was used for this final correction.

Final assets installed in `src/views/Home.jsx`:
- `public/images/cozy/housewarming-four-paws-desktop.png`
- `public/images/cozy/housewarming-four-paws-mobile.png`

Visual review contact sheets: `paws-desktop-after.png`, `paws-mobile-after.png`. Each shows all six hands with four small digit pads plus one large palm pad. Original images remain preserved. The notes below record the earlier generation attempt, not current completion status.

Tool: built-in imagegen (imagegen skill), precise-object-edit.

Candidate: `housewarming-paws-review-desktop.png`.
Not installed on the website: visual review still found incorrect digit counts.
Nobi's curved closed eye and open-mouth smile are represented in this candidate.

Requested prompt: Preserve the cozy home, character proportions, outfits and poses. Give every visible hand exactly four small digit pads plus one separate large palm pad. Make Nobi smile with one curved closed eye and a broad open mouth.

Multiple targeted imagegen revisions did not consistently preserve the required four-digit count. Desktop candidate still needs precise paw retouching; mobile has not been changed. Existing live assets remain unchanged.
