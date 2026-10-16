export interface ContentError {
  /** Repo-relative path of the file the problem is in. */
  file: string;
  message: string;
  severity: 'error' | 'warning';
}

export const contentError = (file: string, message: string): ContentError => ({
  file,
  message,
  severity: 'error',
});

export const contentWarning = (file: string, message: string): ContentError => ({
  file,
  message,
  severity: 'warning',
});
