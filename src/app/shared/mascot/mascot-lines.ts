export type MascotSituation = 'correct' | 'incorrect' | 'hint' | 'perfect' | 'levelUp' | 'streak';

/** Short, encouraging lines for Polly. Kept plain: feedback first, cheer second. */
export const MASCOT_LINES: Record<MascotSituation, readonly string[]> = {
  correct: [
    'Nicely reasoned.',
    'That’s the idea. Keep going.',
    'Good. You’ve got the core of it.',
    'Solid work.',
  ],
  incorrect: [
    'Close. The explanations show where it turned.',
    'This one trips up plenty of engineers. Read the explanations and try again.',
    'Not quite yet. Mistakes here are cheap, so have another go.',
    'Worth another look. Each explanation says why.',
  ],
  hint: [
    'Think about what changes, and what stays the same.',
    'Start with the simplest case.',
    'Ask what happens when something fails.',
  ],
  perfect: ['Every one right. Well done!', 'Perfect score!', 'Flawless. On to the next one?'],
  levelUp: ['Level up! Keep flying.', 'New level reached. Nice progress.'],
  streak: ['Another day, another step.', 'Your streak is growing.'],
};

/** FNV-1a: a small, stable string hash. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The same key always gets the same line, so prerendering and tests are stable. */
export function mascotLine(situation: MascotSituation, key: string): string {
  const lines = MASCOT_LINES[situation];
  return lines[hash(key) % lines.length]!;
}
