import { formatCompact, formatValue } from './format-number';

describe('formatCompact', () => {
  it.each([
    [1_200_000, '1.2M'],
    [350_000, '350K'],
    [4_500_000_000, '4.5B'],
    [0.25, '0.25'],
  ])('%d → %s', (n, text) => {
    expect(formatCompact(n)).toBe(text);
  });
});

describe('formatValue', () => {
  it('groups digits and adds the compact form for large numbers', () => {
    expect(formatValue(2315)).toBe('2,315');
    expect(formatValue(86_400)).toBe('86,400 (86.4K)');
    expect(formatValue(1.5)).toBe('1.5');
  });
});
