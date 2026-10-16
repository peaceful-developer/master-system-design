import { isSearchShortcut } from './search-shortcut';

function key(init: KeyboardEventInit, target: HTMLElement = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, ...init });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

describe('isSearchShortcut', () => {
  it('opens on "/" and on Ctrl+K or Cmd+K', () => {
    expect(isSearchShortcut(key({ key: '/' }))).toBe(true);
    expect(isSearchShortcut(key({ key: 'k', ctrlKey: true }))).toBe(true);
    expect(isSearchShortcut(key({ key: 'K', metaKey: true }))).toBe(true);
  });

  it('ignores other keys', () => {
    expect(isSearchShortcut(key({ key: 'k' }))).toBe(false);
    expect(isSearchShortcut(key({ key: '/', ctrlKey: true }))).toBe(false);
  });

  it('ignores "/" and Ctrl+K typed into a field', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', '');
    for (const target of [input, textarea, editable]) {
      expect(isSearchShortcut(key({ key: '/' }, target))).toBe(false);
      expect(isSearchShortcut(key({ key: 'k', ctrlKey: true }, target))).toBe(false);
    }
  });
});
