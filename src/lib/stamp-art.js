// Upgrade only bundled artwork; custom admin uploads remain untouched.
const REPLACEMENTS = {
  '/images/stamps/event-merit-19sep.webp': '/images/stamps/boota-merit-heaven-v2.webp',
  '/images/stamps/event-busking-26sep.webp': '/images/stamps/nobi-enamel-v1.webp',
};
export const eventStampArt = ev => REPLACEMENTS[ev.stamp?.image] || ev.stamp?.image || null;

// Shared by the live UI and PNG export; keep original files for rollback.
export const SPECIAL_STAMP_ART = {
  lucky: '/images/stamps/lucky-stamp-line-v2.webp',
  tier: '/images/stamps/tier-stamp-line-v2.webp',
  dayone: '/images/stamps/dayone-stamp-line-v2.webp',
  first: '/images/stamps/first-stamp-line-v2.webp',
  friend: '/images/stamps/friend-stamp-line-v2.webp',
};
