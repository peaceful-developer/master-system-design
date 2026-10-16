import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ContentBlock } from '@content/types';
import { ContentBlocksComponent } from './content-blocks.component';

@Component({
  imports: [ContentBlocksComponent],
  template: `<app-content-blocks [blocks]="blocks()" />`,
})
class HostComponent {
  readonly blocks = signal<ContentBlock[]>([
    { kind: 'html', html: '<h2 id="intro">Intro</h2><p>First <strong>part</strong>.</p>' },
    { kind: 'quiz', id: 'caching-quiz' },
    { kind: 'html', html: '<aside class="callout callout-note" role="note"><p>Note</p></aside>' },
  ]);
}

describe('ContentBlocksComponent', () => {
  it('renders HTML blocks with their markup and defers the quiz', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const html = el.querySelectorAll('.prose-content');
    expect(html).toHaveLength(2);
    expect(html[0]!.querySelector('h2#intro')?.textContent).toBe('Intro');
    expect(html[1]!.querySelector('aside.callout-note')?.getAttribute('role')).toBe('note');
    expect(el.querySelectorAll('.exercise-placeholder')).toHaveLength(1);
  });
});
