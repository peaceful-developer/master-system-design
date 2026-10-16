const SUFFIX_POWER: Record<string, number> = { k: 3, m: 6, b: 9, g: 9, t: 12 };
const GROUP_SEPARATORS = /[,_\u2009\u202f ]/g;
const NUMBER_RE =
  /^([+-])?(\d{1,3}(?:[,_\u2009\u202f ]\d{3})+|\d+)?(?:\.(\d+))?(?:e([+-]?\d+))?([kmbgt])?$/i;

/**
 * Reads numbers the way people type estimates: "1.2M", "1,200,000",
 * "1_200_000", "1.2e6", " 3k ". Returns null for anything ambiguous.
 * Suffixes: k = thousand, m = million, b/g = billion, t = trillion.
 */
export function parseHumanNumber(input: string): number | null {
  const match = NUMBER_RE.exec(input.trim());
  if (!match) return null;
  const [, sign = '', integer = '', fraction, exponent, suffix] = match;
  if (!integer && fraction === undefined) return null;
  if (exponent !== undefined && suffix) return null;
  const digits = integer.replace(GROUP_SEPARATORS, '') || '0';
  const mantissa = `${sign}${digits}${fraction !== undefined ? `.${fraction}` : ''}`;
  const power = Number(exponent ?? 0) + (suffix ? SUFFIX_POWER[suffix.toLowerCase()]! : 0);
  const value = Number(`${mantissa}e${power}`);
  return Number.isFinite(value) ? value : null;
}
