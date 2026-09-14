# Nobi concert poster revision

## Final logo compositing (user approved)

Final file: `NOBI_26SEP_4x5_final-logo.png`. Official `bigcat-logo-white.png` resized proportionally by width only to 96×71 pixels, centered at the top. Transparent letter cutouts backed with dark ink for readability. Old generated logo removed within the small sky region only. Pixel comparison confirms zero changes outside that region. Reproducible script: `place-nobi-poster-logo.cjs`. Original external poster remains untouched.

Built-in imagegen edit from user poster, clothed Nobi sheet and official white logo reference. Saved as design-previews/NOBI_26SEP_4x5_proportions-v2.png. Original external file untouched; not installed on website.

Rounder head and stockier body corrected toward sheet. Logo regenerated using official reference, not deterministic original-file compositing; exact brand geometry/aspect ratio is not guaranteed by generated output.

## Main prompt

Use case precise-object-edit. Image1 edit target Thai Nobi concert poster. Image2 authoritative Nobi character sheet for body proportions. Image3 official BigCat logo artwork for top logo. Make ONLY two corrections. (1) Correct Nobi silhouette to sheet: head is rounder/taller, NOT horizontally squashed oval as current poster; exact head width to height approximately 1.25 including ears, head occupies about 54% of total mascot height from ear tips to soles. Short plump torso, stubby arms and short legs; reproduce sheet ratio faithfully without elongating limbs. Keep mascot standing on same stage centered, same overall height, same pink floral frilly dress twin floral bows white bow shoes. Preserve microphone in left image hand, right image paw waving with FOUR small pink digit pads plus one big palm pad, three caramel stripes on exposed arm as existing. Preserve wink curved eyelid and happy open mouth. (2) REPLACE top existing distorted small logo with exact image3 white cat-head BIG CAT logo. Scale UNIFORMLY, width:height=1500:1109 (1.3526), no stretching, squeezing or redrawing letterforms. Center at top with clear margin and no overlap with pink Thai pill below. Use dark readable BIG CAT lettering within white shape. EVERYTHING ELSE locked: all Thai and English text exact same spelling, dates, times, venue, hashtags, free badge, castle stage lights flowers music notes, composition palette. Keep 4:5 portrait poster and crisp quality; no rearranging text. Output one corrected poster.

## Logo follow-up

Precise edit of image1 ONLY TOP LOGO. Current top logo is too horizontally stretched. Replace it with image2 original official logo uniformly scaled, full logo INCLUDING whiskers width to height EXACTLY 1.3526. Target bounding box approximately x=514..609 y=12..82 on 1122x1402 poster: 95 pixels wide by70 pixels high. Center x561. Do not widen beyond95px. Preserve original cat silhouette, two text rows BIG / CAT and original typography from image2. White cat silhouette with dark letters. NO stretching. All rest of poster locked unchanged: Nobi proportions face pose dress and all Thai text/background. Change only logo in top sky.
