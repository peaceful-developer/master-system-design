import { stickyOffset } from './sticky-offset';

function bar(bottom: number): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-sticky-top', '');
  el.getBoundingClientRect = () => ({ bottom }) as DOMRect;
  document.body.append(el);
  return el;
}

describe('stickyOffset', () => {
  afterEach(() => document.body.replaceChildren());

  it('leaves a small gap when nothing is sticky', () => {
    expect(stickyOffset(document)).toBe(16);
  });

  it('clears the lowest sticky bar', () => {
    bar(57);
    bar(105);
    expect(stickyOffset(document)).toBe(121);
  });
});
