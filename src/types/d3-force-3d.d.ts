declare module "d3-zoom" {
  export function zoom<GElement extends Element, Datum>(): any;
  export const zoomIdentity: { k: number; x: number; y: number; translate: (x: number, y: number) => any; scale: (k: number) => any; toString: () => string };
}

declare module "d3-selection" {
  export function select(selector: any): any;
}
