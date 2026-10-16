const GAP = 16;

/**
 * How far below the top of the window an anchor should land so that sticky
 * bars (marked `data-sticky-top`) don't cover it. Angular's anchor scrolling
 * ignores CSS `scroll-margin-top`, so the router is given this offset instead.
 */
export function stickyOffset(doc: Document): number {
  const bottoms = [...doc.querySelectorAll('[data-sticky-top]')].map(
    (el) => el.getBoundingClientRect().bottom,
  );
  return Math.max(0, ...bottoms) + GAP;
}
