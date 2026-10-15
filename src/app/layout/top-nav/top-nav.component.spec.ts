import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SITE_NAME } from '../../site';
import { TopNavComponent } from './top-nav.component';

describe('TopNavComponent', () => {
  async function render() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(TopNavComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('links home with the site name', async () => {
    const { el } = await render();
    const home = el.querySelector('a[href="/"]');
    expect(home?.textContent).toContain(SITE_NAME);
  });

  it('renders the seven primary sections in order', async () => {
    const { el } = await render();
    const links = [...el.querySelectorAll('#primary-nav a')].map((a) => [
      a.textContent?.trim(),
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Path', '/path'],
      ['Case studies', '/case-studies'],
      ['Playbooks', '/playbooks'],
      ['Examples', '/examples'],
      ['Exercises', '/exercises'],
      ['Glossary', '/glossary'],
      ['Progress', '/progress'],
    ]);
  });

  it('has a labelled theme toggle', async () => {
    const { el } = await render();
    const toggle = el.querySelector('button[aria-label^="Theme:"]');
    expect(toggle?.getAttribute('aria-label')).toBe('Theme: light. Switch to dark');
  });

  it('opens and closes the mobile menu with aria-expanded', async () => {
    const { el, fixture } = await render();
    const button = el.querySelector<HTMLButtonElement>('button[aria-controls="primary-nav"]')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});
