/** Types for the parts of gifenc 1.0.3 that scripts/capture-demo.ts uses (the package ships none). */
declare module 'gifenc' {
  export type Color = number[];
  export interface FrameOptions {
    palette?: Color[];
    delay?: number;
    transparent?: boolean;
    transparentIndex?: number;
    dispose?: number;
    repeat?: number;
  }
  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: FrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  const gifenc: {
    GIFEncoder(options?: { auto?: boolean }): Encoder;
    quantize(rgba: Uint8Array, maxColors: number): Color[];
    applyPalette(rgba: Uint8Array, palette: Color[]): Uint8Array;
  };
  export default gifenc;
}
