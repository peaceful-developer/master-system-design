import type { ComponentDef, Diagram } from '@content/types';
import { layoutDiagram, NODE_H, NODE_W, PAD } from './diagram-geometry';

const comp = (type: string, category: ComponentDef['category']): ComponentDef => ({
  type,
  label: type,
  category,
  icon: type,
  description: 'A test component.',
  sim: { capacityRps: 1, instances: 1, baseLatencyMs: 0, costPerHourPerInstance: 0 },
});
const catalog = new Map([
  ['client', comp('client', 'clients-edge')],
  ['app-server', comp('app-server', 'compute')],
  ['cache', comp('cache', 'data')],
]);

const diagram: Diagram = {
  id: 'd',
  nodes: [
    { id: 'c', type: 'client', label: 'Client', position: { x: 0, y: 100 } },
    {
      id: 'a',
      type: 'app-server',
      label: 'App',
      position: { x: 300, y: 100 },
      config: { instances: 3 },
    },
    { id: 'k', type: 'cache', label: 'Cache', position: { x: 600, y: 0 } },
  ],
  edges: [
    { id: 'e1', from: 'c', to: 'a' },
    { id: 'e2', from: 'a', to: 'k', label: 'read' },
    { id: 'e3', from: 'k', to: 'a' },
  ],
};

function endpoints(d: string): [number, number][] {
  return [...d.matchAll(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
}

function onBoundary([x, y]: [number, number], left: number, top: number): boolean {
  const right = left + NODE_W;
  const bottom = top + NODE_H;
  const inside = x >= left - 0.5 && x <= right + 0.5 && y >= top - 0.5 && y <= bottom + 0.5;
  const near = [x - left, right - x, y - top, bottom - y].some((v) => Math.abs(v) <= 0.5);
  return inside && near;
}

describe('layoutDiagram', () => {
  it('fits every node plus padding in the viewBox', () => {
    const { viewBox } = layoutDiagram(diagram, catalog);
    expect(viewBox).toEqual({
      x: -PAD,
      y: -PAD,
      width: 600 + NODE_W + 2 * PAD,
      height: 100 + NODE_H + 2 * PAD,
    });
  });

  it('starts and ends every edge on the boundary of its nodes', () => {
    const { edges } = layoutDiagram(diagram, catalog);
    const pos = Object.fromEntries(diagram.nodes.map((n) => [n.id, n.position]));
    for (const edge of edges) {
      const [start, end] = endpoints(edge.d);
      expect(onBoundary(start!, pos[edge.from]!.x, pos[edge.from]!.y), `${edge.id} start`).toBe(
        true,
      );
      expect(onBoundary(end!, pos[edge.to]!.x, pos[edge.to]!.y), `${edge.id} end`).toBe(true);
    }
  });

  it('separates the two directions of a bidirectional pair', () => {
    const { edges } = layoutDiagram(diagram, catalog);
    const forward = edges.find((e) => e.id === 'e2')!;
    const back = edges.find((e) => e.id === 'e3')!;
    expect(forward.d).not.toBe(back.d);
    const [fs] = endpoints(forward.d);
    const [, be] = endpoints(back.d);
    expect(Math.hypot(fs![0] - be![0], fs![1] - be![1])).toBeGreaterThan(8);
  });

  it('places edge labels at the midpoint', () => {
    const edge = layoutDiagram(diagram, catalog).edges.find((e) => e.id === 'e2')!;
    const [s, e] = endpoints(edge.d);
    expect(edge.label).toBe('read');
    expect(edge.labelAt!.x).toBeCloseTo((s![0] + e![0]) / 2, 0);
  });

  it('carries category, icon and instance count onto nodes', () => {
    const app = layoutDiagram(diagram, catalog).nodes.find((n) => n.id === 'a')!;
    expect(app).toMatchObject({
      category: 'compute',
      icon: 'app-server',
      instances: 3,
      w: NODE_W,
      h: NODE_H,
    });
  });

  it('uses a default viewBox for an empty diagram', () => {
    expect(layoutDiagram({ id: 'x', nodes: [], edges: [] }, catalog).viewBox).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 200,
    });
  });
});
