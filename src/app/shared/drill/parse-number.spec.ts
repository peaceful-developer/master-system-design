import { parseHumanNumber } from './parse-number';

describe('parseHumanNumber', () => {
  it.each([
    ['1.2M', 1_200_000],
    ['1,200,000', 1_200_000],
    ['1_200_000', 1_200_000],
    ['1.2e6', 1_200_000],
    [' 3k ', 3000],
    ['3K', 3000],
    ['4.5b', 4_500_000_000],
    ['2t', 2_000_000_000_000],
    ['-5', -5],
    ['0', 0],
    ['.5', 0.5],
    ['2315', 2315],
    ['6,944.4', 6944.4],
  ])('reads %j as %d', (input, expected) => {
    expect(parseHumanNumber(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '1.2.3', '1,2', '5kk', '12,34,567', '1e', 'k', '1e3k', '--5'])(
    'rejects %j',
    (input) => {
      expect(parseHumanNumber(input)).toBeNull();
    },
  );
});
