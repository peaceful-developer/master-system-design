import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { applyStaticHtml, StaticHtmlDirective } from './static-html.directive';

describe('applyStaticHtml', () => {
  it('writes the HTML into a fresh element and records its hash', () => {
    const el = document.createElement('div');
    expect(applyStaticHtml(el, '<p>Hello</p>')).toBe(true);
    expect(el.innerHTML).toBe('<p>Hello</p>');
    expect(el.getAttribute('data-html-hash')).toMatch(/^[0-9a-z]+$/);
  });

  it('keeps prerendered markup in place when it was rendered from the same HTML', () => {
    const server = document.createElement('div');
    applyStaticHtml(server, '<p>Hello</p>');
    // What the browser parses from the prerendered page:
    const el = document.createElement('div');
    el.innerHTML = server.innerHTML;
    el.setAttribute('data-html-hash', server.getAttribute('data-html-hash')!);
    const paragraph = el.firstChild;

    expect(applyStaticHtml(el, '<p>Hello</p>')).toBe(false);
    expect(el.firstChild).toBe(paragraph);
  });

  it('replaces the markup when the HTML is different', () => {
    const el = document.createElement('div');
    applyStaticHtml(el, '<p>Old</p>');
    expect(applyStaticHtml(el, '<p>New</p>')).toBe(true);
    expect(el.innerHTML).toBe('<p>New</p>');
  });

  it('writes again if an element claims the hash but is empty', () => {
    const el = document.createElement('div');
    applyStaticHtml(el, '<p>Hello</p>');
    el.innerHTML = '';
    expect(applyStaticHtml(el, '<p>Hello</p>')).toBe(true);
    expect(el.innerHTML).toBe('<p>Hello</p>');
  });
});

@Component({
  imports: [StaticHtmlDirective],
  template: `<div [appStaticHtml]="html()"></div>`,
})
class HostComponent {
  readonly html = signal('<p>First</p>');
}

describe('StaticHtmlDirective', () => {
  it('renders its HTML and follows changes', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const div = (fixture.nativeElement as HTMLElement).querySelector('div')!;
    expect(div.innerHTML).toBe('<p>First</p>');

    fixture.componentInstance.html.set('<p>Second</p>');
    await fixture.whenStable();
    expect(div.innerHTML).toBe('<p>Second</p>');
  });
});
