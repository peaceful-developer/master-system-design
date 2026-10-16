import type { ComponentCategory, ComponentDef, Diagram } from '@content/types';
import { shapeDetail, shapePath } from './node-shapes';

export const NODE_W = 168;
export const NODE_H = 72;
export const PAD = 32;
const PARALLEL_OFFSET = 8;

export interface Point {
  x: number;
  y: number;
}

export interface LaidOutNode {
  id: string;
  label: string;
  type: string;
  typeLabel: string;
  /** The type name that fits under the node title. */
  typeShort: string;
  category: ComponentCategory;
  icon: string;
  instances: number;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: string;
  detail: string | null;
}

export interface LaidOutEdge {
  id: string;
  from: string;
  to: string;
  d: string;
  label?: string;
  labelAt?: Point;
}

export interface DiagramLayout {
  viewBox: { x: number; y: number; width: number; height: number };
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
}

const round = (v: number) => Math.round(v * 10) / 10;

/** Where a ray from `p` (inside the rect) in direction `v` leaves the rect. */
function exitPoint(left: number, top: number, p: Point, v: Point): Point {
  const right = left + NODE_W;
  const bottom = top + NODE_H;
  const tx = v.x > 0 ? (right - p.x) / v.x : v.x < 0 ? (left - p.x) / v.x : Infinity;
  const ty = v.y > 0 ? (bottom - p.y) / v.y : v.y < 0 ? (top - p.y) / v.y : Infinity;
  const t = Math.min(tx, ty);
  return { x: p.x + t * v.x, y: p.y + t * v.y };
}

/** Pure layout for the read-only viewer: node shapes at their positions, straight edges clipped to node borders. */
export function layoutDiagram(
  diagram: Diagram,
  catalog: ReadonlyMap<string, ComponentDef>,
): DiagramLayout {
  const nodes: LaidOutNode[] = diagram.nodes.map((node) => {
    const def = catalog.get(node.type);
    const category = def?.category ?? 'compute';
    const instances = Number(node.config?.['instances'] ?? def?.sim.instances ?? 1);
    return {
      id: node.id,
      label: node.label,
      type: node.type,
      typeLabel: def?.label ?? node.type,
      typeShort: def?.shortLabel ?? def?.label ?? node.type,
      category,
      icon: def?.icon ?? 'circle',
      instances: Number.isFinite(instances) ? instances : 1,
      x: node.position.x,
      y: node.position.y,
      w: NODE_W,
      h: NODE_H,
      shape: shapePath(category, NODE_W, NODE_H),
      detail: shapeDetail(category, NODE_W),
    };
  });

  if (nodes.length === 0)
    return { viewBox: { x: 0, y: 0, width: 400, height: 200 }, nodes, edges: [] };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pairs = new Set(diagram.edges.map((e) => `${e.from}>${e.to}`));
  const edges: LaidOutEdge[] = diagram.edges.flatMap((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return [];
    const c1 = { x: from.x + NODE_W / 2, y: from.y + NODE_H / 2 };
    const c2 = { x: to.x + NODE_W / 2, y: to.y + NODE_H / 2 };
    const v = { x: c2.x - c1.x, y: c2.y - c1.y };
    const len = Math.hypot(v.x, v.y) || 1;
    // A reverse edge exists: shift this one sideways so both arrows stay visible.
    const shift = pairs.has(`${edge.to}>${edge.from}`) ? PARALLEL_OFFSET : 0;
    const off = { x: (-v.y / len) * shift, y: (v.x / len) * shift };
    const start = exitPoint(from.x, from.y, { x: c1.x + off.x, y: c1.y + off.y }, v);
    const end = exitPoint(to.x, to.y, { x: c2.x + off.x, y: c2.y + off.y }, { x: -v.x, y: -v.y });
    return [
      {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        d: `M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}`,
        label: edge.label,
        labelAt: { x: round((start.x + end.x) / 2), y: round((start.y + end.y) / 2) },
      },
    ];
  });

  const minX = Math.min(...nodes.map((n) => n.x)) - PAD;
  const minY = Math.min(...nodes.map((n) => n.y)) - PAD;
  const maxX = Math.max(...nodes.map((n) => n.x + NODE_W)) + PAD;
  const maxY = Math.max(...nodes.map((n) => n.y + NODE_H)) + PAD;
  return { viewBox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }, nodes, edges };
}
