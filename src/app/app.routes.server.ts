import { RenderMode, type ServerRoute } from '@angular/ssr';
import type { RoutesFile } from '@content/types';
import generatedRoutes from '@generated/routes.json';

const ROUTES = generatedRoutes as RoutesFile;

/** Every content page is prerendered to static HTML; params come from the content build. */
export const serverRoutes: ServerRoute[] = [
  {
    path: 'learn/:phase/:lesson',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => ROUTES.params.lessons,
  },
  {
    path: 'playbooks/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => ROUTES.params.playbooks,
  },
  {
    path: 'examples/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => ROUTES.params.examples,
  },
  {
    path: 'exercises/:id',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => ROUTES.params.exercises,
  },
  { path: '**', renderMode: RenderMode.Prerender },
];
