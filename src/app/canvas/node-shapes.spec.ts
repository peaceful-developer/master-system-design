import { CATEGORY_LABELS, shapePath } from './node-shapes';

const CATEGORIES = ['clients-edge', 'compute', 'data', 'messaging', 'ml', 'llm'] as const;

describe('shapePath', () => {
  it('gives every category its own closed outline', () => {
    const paths = CATEGORIES.map((c) => shapePath(c, 168, 72));
    expect(new Set(paths).size).toBe(6);
    for (const d of paths) expect(d.trim().endsWith('Z')).toBe(true);
  });

  it('labels every category in words for the legend', () => {
    expect(CATEGORIES.map((c) => CATEGORY_LABELS[c])).toEqual([
      'Clients & edge',
      'Compute',
      'Data',
      'Messaging',
      'ML',
      'LLM',
    ]);
  });
});
