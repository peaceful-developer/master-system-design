/** True for "/" and Ctrl/⌘+K, unless the learner is typing in a field. */
export function isSearchShortcut(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable ||
      isEditableAttribute(target.getAttribute?.('contenteditable')))
  ) {
    return false;
  }
  const modifier = event.ctrlKey || event.metaKey;
  if (event.key === '/' && !modifier && !event.altKey) return true;
  return modifier && !event.altKey && event.key.toLowerCase() === 'k';
}

/** `contenteditable`, `contenteditable=""` and `contenteditable="true"` all mean editable. */
function isEditableAttribute(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value !== 'false';
}
