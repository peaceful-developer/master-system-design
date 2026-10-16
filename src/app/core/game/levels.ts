export interface Level {
  n: number;
  name: string;
  min: number;
}

export const LEVELS: readonly Level[] = [
  { n: 1, name: 'Egg', min: 0 },
  { n: 2, name: 'Hatchling', min: 50 },
  { n: 3, name: 'Fledgling', min: 150 },
  { n: 4, name: 'Flyer', min: 300 },
  { n: 5, name: 'Navigator', min: 500 },
  { n: 6, name: 'Flock Leader', min: 800 },
  { n: 7, name: 'Architect', min: 1200 },
  { n: 8, name: 'Principal Parrot', min: 1700 },
];

export interface LevelStatus {
  level: Level;
  next?: Level;
  /** 0–1 through the current level; 1 at the top level. */
  progressToNext: number;
}

export function levelFor(xp: number): LevelStatus {
  let index = 0;
  LEVELS.forEach((l, i) => {
    if (xp >= l.min) index = i;
  });
  const level = LEVELS[index]!;
  const next = LEVELS[index + 1];
  if (!next) return { level, progressToNext: 1 };
  return { level, next, progressToNext: (xp - level.min) / (next.min - level.min) };
}
