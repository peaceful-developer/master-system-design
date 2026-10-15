import type { Routes } from '@angular/router';
import {
  exampleResolver,
  lessonResolver,
  playbookResolver,
} from './core/content/content-resolvers';

export const routes: Routes = [
  {
    path: 'learn/:phase/:lesson',
    loadComponent: () => import('./features/lesson/lesson.page').then((m) => m.LessonPage),
    resolve: { lesson: lessonResolver },
  },
  {
    path: 'playbooks',
    loadComponent: () => import('./features/playbooks/playbooks.page').then((m) => m.PlaybooksPage),
  },
  {
    path: 'playbooks/:slug',
    loadComponent: () => import('./features/playbook/playbook.page').then((m) => m.PlaybookPage),
    resolve: { playbook: playbookResolver },
  },
  {
    path: 'examples',
    loadComponent: () => import('./features/examples/examples.page').then((m) => m.ExamplesPage),
  },
  {
    path: 'examples/:slug',
    loadComponent: () => import('./features/example/example.page').then((m) => m.ExamplePage),
    resolve: { example: exampleResolver },
  },
  {
    path: 'not-found',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
