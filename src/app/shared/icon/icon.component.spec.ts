import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';

@Component({
  imports: [IconComponent],
  template: `
    <app-icon name="search" />
    <app-icon name="check" label="Completed" />
    <app-icon name="does-not-exist" />
  `,
})
class HostComponent {}

describe('IconComponent', () => {
  async function render() {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('app-icon')];
  }

  it('renders a decorative icon hidden from assistive technology', async () => {
    const [search] = await render();
    const svg = search!.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.innerHTML).toContain('<circle');
  });

  it('exposes a labelled icon as an image', async () => {
    const [, check] = await render();
    const svg = check!.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Completed');
    expect(svg.hasAttribute('aria-hidden')).toBe(false);
  });

  it('renders nothing for an unknown icon instead of throwing', async () => {
    const [, , unknown] = await render();
    expect(unknown!.querySelector('svg')).toBeNull();
  });
});
