import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken } from '@angular/core';

/** Whether the visitor asked for reduced motion; always false while prerendering. */
export const REDUCED_MOTION = new InjectionToken<() => boolean>('REDUCED_MOTION', {
  providedIn: 'root',
  factory: () => {
    const view = inject(DOCUMENT).defaultView;
    return () => view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  },
});
