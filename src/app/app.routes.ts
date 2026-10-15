import type { Routes } from '@angular/router';
import {
  exampleResolver,
  exerciseResolver,
  lessonResolver,
  playbookResolver,
} from './core/content/content-resolvers';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'path',
    loadComponent: () => import('./features/path/path.page').then((m) => m.PathPage),
  },
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
    path: 'exercises',
    loadComponent: () => import('./features/exercises/exercises.page').then((m) => m.ExercisesPage),
  },
  {
    path: 'exercises/:id',
    loadComponent: () => import('./features/exercise/exercise.page').then((m) => m.ExercisePage),
    resolve: { exercise: exerciseResolver },
  },
  {
    path: 'glossary',
    loadComponent: () => import('./features/glossary/glossary.page').then((m) => m.GlossaryPage),
  },
  {
    path: 'progress',
    loadComponent: () => import('./features/progress/progress.page').then((m) => m.ProgressPage),
  },
  {
    path: 'contribute',
    loadComponent: () =>
      import('./features/contribute/contribute.page').then((m) => m.ContributePage),
  },
  {
    path: 'playground',
    loadComponent: () =>
      import('./features/playground/playground.page').then((m) => m.PlaygroundPage),
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
