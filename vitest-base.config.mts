import { defineConfig } from 'vitest/config';

// Loaded by `ng test` (angular.json → test.options.runnerConfig).
// Vitest 5's filesystem module cache keys Angular's in-memory test bundles by
// spec path, so edits to components under test were served stale. Disable it.
export default defineConfig({
  test: {
    fsModuleCache: false,
  },
});
