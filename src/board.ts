// board.ts

export interface Cell {
  x: number;
  y: number;
}

export interface Coins {
  coord: Cell;
  serial: number;
}

export class Board {
  private oldCells: Map<string, Cell>;

  constructor() {
    this.oldCells = new Map();
  }

  getGridCell(x: number, y: number): Cell {
    const i = Math.round(x * 10000);
    const j = Math.round(y * 10000);
    const key = `${i}_${j}`;
    if (this.oldCells.has(key)) {
      return this.oldCells.get(key)!;
    } else {
      const newCell: Cell = { x: i, y: j };
      this.oldCells.set(key, newCell);
      return newCell;
    }
  }

  printBoard() {
    console.log(this.oldCells);
  }

  clearBoard() {
    this.oldCells.clear();
  }
}

export class Cache {
  coinList: Coins[];
  formatList: string[];
  cell: Cell;
  description: string;

  constructor(cell: Cell) {
    this.description = `${cell.x}_${cell.y}`;
    this.cell = cell;
    this.coinList = [];
    this.formatList = [];
  }

  addCoin() {
    const Serial: number =
      this.coinList.length > 0
        ? this.coinList[this.coinList.length - 1].serial + 1
        : 0;
    this.coinList.push({ coord: this.cell, serial: Serial });
    this.formatList.push(`${this.cell.x}#${this.cell.y}#${Serial}`);
    this.description = this.formatList.join(",");
  }

  format(): string[] {
    const res: string[] = [];
    this.coinList.map((coin) => {
      res.push(
        `${coin.coord.x.toFixed(0)}:${coin.coord.y.toFixed(0)}#${coin.serial}`
      );
    });
    return res;
  }

  toMomento(): string {
    return this.description;
  }

  fromMomento(momento: string) {
    this.description = momento;
    this.formatList = momento.split(",");
    this.coinList = [];
    this.formatList.forEach((instance) => {
      const tempArr: string[] = instance.split("#");
      this.coinList.push({ coord: this.cell, serial: Number(tempArr[2]) });
    });
  }
}
