declare module "d3-force-3d" {
  export function forceSimulation(nodes?: any[], numDimensions?: number): any;
  export function forceLink(links?: any[], numDimensions?: number): any;
  export function forceManyBody(numDimensions?: number): any;
  export function forceCenter(x?: number, y?: number, numDimensions?: number): any;
  export function forceCollide(numDimensions?: number): any;
  export function forceX(x?: number, numDimensions?: number): any;
  export function forceY(y?: number, numDimensions?: number): any;
  export function forceRadial(numDimensions?: number): any;
}

declare module "d3-zoom" {
  export function zoom<GElement extends Element, Datum>(): any;
  export const zoomIdentity: { k: number; x: number; y: number; translate: (x: number, y: number) => any; scale: (k: number) => any; toString: () => string };
}

declare module "d3-selection" {
  export function select(selector: any): any;
}
