export interface PixelPath {
  color: string;
  d: string;
}

type Predicate = (x: number, y: number) => boolean;

/** A tiny bitmap used to draw procedural sprites one pixel at a time, then turn them into SVG paths. */
export class PixelGrid {
  private readonly cells: (string | undefined)[];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.cells = new Array<string | undefined>(width * height).fill(undefined);
  }

  get(x: number, y: number): string | undefined {
    return this.inside(x, y) ? this.cells[y * this.width + x] : undefined;
  }

  set(x: number, y: number, color: string | undefined): void {
    if (this.inside(x, y)) this.cells[y * this.width + x] = color;
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    for (let row = y; row < y + h; row += 1) for (let col = x; col < x + w; col += 1) this.set(col, row, color);
  }

  /** Centre and radii are in pixel units; a higher `power` makes the shape squarer. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string, power = 2): void {
    this.fill(color, (x, y) => (Math.abs(x + 0.5 - cx) / rx) ** power + (Math.abs(y + 0.5 - cy) / ry) ** power <= 1);
  }

  /** Paints every cell for which the predicate holds. */
  fill(color: string, predicate: Predicate): void {
    for (let y = 0; y < this.height; y += 1) for (let x = 0; x < this.width; x += 1) if (predicate(x, y)) this.set(x, y, color);
  }

  /** Paints only over cells that are already filled and match the predicate. */
  recolor(predicate: (x: number, y: number, current: string) => string | undefined): void {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const current = this.get(x, y);
        const next = current ? predicate(x, y, current) : undefined;
        if (next) this.set(x, y, next);
      }
    }
  }

  isFilled(x: number, y: number): boolean {
    return this.get(x, y) !== undefined;
  }

  /** Adds a one pixel outline on the empty cells that touch a filled cell. */
  outline(color: string): void {
    const edge: [number, number][] = [];
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (this.isFilled(x, y)) continue;
        if (this.isFilled(x - 1, y) || this.isFilled(x + 1, y) || this.isFilled(x, y - 1) || this.isFilled(x, y + 1)) edge.push([x, y]);
      }
    }
    for (const [x, y] of edge) this.set(x, y, color);
  }

  /** One SVG path per colour, with horizontal runs merged. */
  paths(): PixelPath[] {
    const byColor = new Map<string, string[]>();
    for (let y = 0; y < this.height; y += 1) {
      let x = 0;
      while (x < this.width) {
        const color = this.get(x, y);
        if (!color) {
          x += 1;
          continue;
        }
        let end = x + 1;
        while (this.get(end, y) === color) end += 1;
        const commands = byColor.get(color) ?? [];
        commands.push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
        byColor.set(color, commands);
        x = end;
      }
    }
    return [...byColor].map(([color, commands]) => ({ color, d: commands.join('') }));
  }

  private inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }
}
