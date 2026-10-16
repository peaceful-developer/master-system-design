import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentDef, Diagram } from '@content/types';
import { DiagramViewerComponent } from './diagram-viewer.component';

const comp = (type: string, label: string, category: ComponentDef['category']): ComponentDef => ({
  type,
  label,
  category,
  icon: 'client',
  description: 'A test component.',
  sim: { capacityRps: 1, instances: 1, baseLatencyMs: 0, costPerHourPerInstance: 0 },
});
const CATALOG = new Map([
  ['client', comp('client', 'Client', 'clients-edge')],
  ['app-server', { ...comp('app-server', 'App server', 'compute'), shortLabel: 'Server' }],
]);
const DIAGRAM: Diagram = {
  id: 'demo',
  title: 'Demo design',
  nodes: [
    { id: 'c', type: 'client', label: 'Browser', position: { x: 0, y: 0 } },
    {
      id: 'a',
      type: 'app-server',
      label: 'API',
      position: { x: 300, y: 0 },
      config: { instances: 3 },
    },
  ],
  edges: [{ id: 'e1', from: 'c', to: 'a', label: 'HTTPS' }],
};

@Component({
  imports: [DiagramViewerComponent],
  template: `
    <app-diagram-viewer [diagram]="diagram" [catalog]="catalog" />
    <app-diagram-viewer [diagram]="diagram" [catalog]="catalog" />
    <app-diagram-viewer [diagram]="empty" [catalog]="catalog" />
  `,
})
class HostComponent {
  readonly diagram = DIAGRAM;
  readonly empty: Diagram = { id: 'empty', nodes: [], edges: [] };
  readonly catalog = CATALOG;
}

describe('DiagramViewerComponent', () => {
  async function render() {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('app-diagram-viewer')];
  }

  it('renders an accessible SVG named by its title', async () => {
    const [first] = await render();
    const svg = first!.querySelector('svg.diagram-svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    const titleId = svg.getAttribute('aria-labelledby')!.split(' ')[0]!;
    expect(first!.querySelector(`[id="${titleId}"]`)?.textContent).toBe('Demo design');
    expect(first!.querySelectorAll('g.diagram-node')).toHaveLength(2);
  });

  it('offers a text description of every component and connection', async () => {
    const [first] = await render();
    const text = first!.querySelector('details')!.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Browser (Client)');
    expect(text).toContain('API (App server, ×3)');
    expect(text).toContain('Browser → API (HTTPS)');
  });

  it('puts the short type name under each node title', async () => {
    const [first] = await render();
    const subtitles = [...first!.querySelectorAll('.diagram-node-type')].map((t) =>
      t.textContent!.trim(),
    );
    expect(subtitles).toEqual(['Client', 'Server ×3']);
  });

  it('shows a legend that names each category in words', async () => {
    const [first] = await render();
    const legend = first!.querySelector('.diagram-legend')!.textContent!;
    expect(legend).toContain('Clients & edge');
    expect(legend).toContain('Compute');
  });

  it('keeps arrow marker ids unique when a diagram appears twice', async () => {
    const [a, b] = await render();
    const idA = a!.querySelector('marker')!.id;
    const idB = b!.querySelector('marker')!.id;
    expect(idA).not.toBe(idB);
    expect(a!.querySelector('path.diagram-edge')!.getAttribute('marker-end')).toBe(`url(#${idA})`);
  });

  it('says so when a diagram is empty', async () => {
    const [, , empty] = await render();
    expect(empty!.textContent).toContain('No components yet');
    expect(empty!.querySelector('svg.diagram-svg')).toBeNull();
  });
});
