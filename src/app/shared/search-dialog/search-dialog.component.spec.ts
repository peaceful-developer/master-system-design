import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SEARCH_INDEX_LOADER } from '../../core/search/search.service';
import { testSearchIndex } from '../../testing/search-test-index';
import { SearchDialogComponent } from './search-dialog.component';

async function openDialog() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: SEARCH_INDEX_LOADER, useValue: async () => testSearchIndex() },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const ref = TestBed.inject(Dialog).open(SearchDialogComponent, { ariaLabel: 'Search' });
  TestBed.tick();
  const input = () => document.querySelector<HTMLInputElement>('input[role="combobox"]')!;
  const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];
  const type = async (text: string) => {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(options().length).toBeGreaterThan(0));
  };
  const press = (key: string) => {
    // CDK closes dialogs on the legacy keyCode, so set it as a browser would.
    const keyCode = key === 'Escape' ? 27 : 0;
    const event = new KeyboardEvent('keydown', { key, bubbles: true });
    Object.defineProperty(event, 'keyCode', { value: keyCode });
    input().dispatchEvent(event);
    TestBed.tick();
  };
  return { ref, navigate, input, options, type, press };
}

describe('SearchDialogComponent', () => {
  afterEach(() => TestBed.inject(Dialog).closeAll());

  it('is a combobox that lists results and labels their kind in text', async () => {
    const { input, options, type } = await openDialog();
    expect(input().getAttribute('aria-expanded')).toBe('false');
    await type('cache');
    expect(input().getAttribute('aria-expanded')).toBe('true');
    const list = document.getElementById(input().getAttribute('aria-controls')!)!;
    expect(list.getAttribute('role')).toBe('listbox');
    expect(options()[0]?.textContent).toMatch(/Lesson|Glossary|Exercise/);
  });

  it('moves with the arrow keys and opens the active result with Enter', async () => {
    const { input, options, type, press, navigate } = await openDialog();
    await type('cache');
    press('ArrowDown');
    press('ArrowDown');
    const second = options()[1]!;
    expect(input().getAttribute('aria-activedescendant')).toBe(second.id);
    expect(second.getAttribute('aria-selected')).toBe('true');
    press('Enter');
    expect(navigate).toHaveBeenCalledWith(second.getAttribute('data-url'));
  });

  it('closes on Escape', async () => {
    const { ref, press } = await openDialog();
    const closed = vi.fn();
    ref.closed.subscribe(closed);
    press('Escape');
    await vi.waitFor(() => expect(closed).toHaveBeenCalled());
  });

  it('says when nothing matches', async () => {
    const { input } = await openDialog();
    input().value = 'zzqqxx';
    input().dispatchEvent(new Event('input'));
    await vi.waitFor(() =>
      expect(document.querySelector('.search-status')?.textContent).toContain('No results'),
    );
  });
});
