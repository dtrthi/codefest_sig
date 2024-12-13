import {
  Direction,
  DirectionPath,
  inPosArray,
  samePosition,
  TreeNode,
} from './position';
import {MapArr, MapCellType, Position} from './ticktack-info';

export class MapScanner {
  targets: TreeNode[] = [];

  constructor(
    private map: MapArr,
    private start: Position,
    private power: number,
    private dangerPositions: Position[],
    private blockedPositions: Position[],
    private filter: (map: MapArr, p: Position) => boolean,
  ) {
    this.scan();
  }

  scan() {
    const rootNode = new TreeNode(this.start);
    const queue: TreeNode[] = [rootNode];
    const visited: Position[] = [];
    this.targets = [];

    while (queue.length) {
      const node = queue.shift();
      if (!node || inPosArray(visited, node.p)) {
        continue;
      }
      visited.push(node.p);

      const neighborPositions = this.getNeighbors(node.p);
      for (const neighbor of neighborPositions) {
        if (this.safeToReach(neighbor)) {
          const v = this.map[neighbor.row][neighbor.col];
          const neighborNode = new TreeNode(neighbor, node, v);
          neighborNode.hitBox = this.countBoxHit(neighbor);
          if (
            this.shouldPassDanger(neighbor) &&
            this.canPassThrough(neighbor) &&
            !inPosArray(this.blockedPositions, neighbor)
          ) {
            queue.push(neighborNode);
          }
          if (
            !inPosArray(this.blockedPositions, neighbor) &&
            this.filter(this.map, neighbor)
          ) {
            this.targets.push(neighborNode);
          }
        }
      }
    }
  }

  nextTarget(
    targetSelector?: (targets: TreeNode[]) => TreeNode | null,
  ): DirectionPath | null {
    const randomSelector = (nodes: TreeNode[]) => {
      const selectedIndex = Math.floor(Math.random() * nodes.length);
      const selected = nodes[selectedIndex];
      return selected;
    };
    if (!targetSelector) {
      targetSelector = randomSelector;
    }
    if (this.targets.length) {
      const selected = targetSelector(this.targets);
      if (selected) {
        return TreeNode.tracePath(selected);
      }
    }

    return null;
  }

  getNeighbors(p: Position): Position[] {
    const neighbors: Position[] = [];
    const directions = this.randomDirections();
    let np: Position;
    for (const d of directions) {
      const np: Position = this.getNeighbor(p, d);
      if (!this.inMap(np)) {
        continue;
      }
      neighbors.push(np);
    }
    return neighbors;
  }

  getNeighbor(p: Position, direction: Direction): Position {
    switch (direction) {
      case Direction.LEFT:
        return {
          row: p.row - 1,
          col: p.col,
        };
      case Direction.RIGHT:
        return {
          row: p.row + 1,
          col: p.col,
        };
      case Direction.UP:
        return {
          row: p.row,
          col: p.col - 1,
        };
      case Direction.DOWN:
        return {
          row: p.row,
          col: p.col + 1,
        };
    }
  }

  randomDirections(): Direction[] {
    const result: Direction[] = [];
    const first = Math.floor(Math.random() * 4) + 1;
    result.push(first);

    const second = Math.floor(Math.random() * 3) + 1;
    if (result.includes(second)) {
      let check = second + 1;
      while (result.includes(check)) {
        check = check + 1;
      }
      result.push(check);
    } else {
      result.push(second);
    }

    const third = Math.floor(Math.random() * 2) + 1;
    if (result.includes(third)) {
      let check = third + 1;
      while (result.includes(check)) {
        check = check + 1;
      }
      result.push(check);
    } else {
      result.push(third);
    }

    for (let i = 1; i <= 4; i++) {
      if (!result.includes(i)) {
        result.push(i);
        break;
      }
    }

    return result;
  }

  inMap(p: Position): boolean {
    if (!Array.isArray(this.map[p.row])) {
      return false;
    }
    if (this.map[p.row][p.col] === undefined) {
      return false;
    }

    return true;
  }

  safeToReach(p: Position): boolean {
    if (this.map[p.row][p.col] === MapCellType.EmptyCell) {
      return true;
    }
    if (this.map[p.row][p.col] === MapCellType.BrickWall) {
      return true;
    }
    if (this.map[p.row][p.col] === MapCellType.GodBadge) {
      return true;
    }
    if (this.map[p.row][p.col] === MapCellType.Balk) {
      return true;
    }
    return false;
  }

  canPassThrough(p: Position): boolean {
    return MapScanner.passThrough(this.map, p);
  }

  static passThrough(map: MapArr, p: Position): boolean {
    if (map[p.row][p.col] === MapCellType.EmptyCell) {
      return true;
    }
    if (map[p.row][p.col] === MapCellType.GodBadge) {
      return true;
    }
    return false;
  }

  shouldPassDanger(p: Position): boolean {
    if (
      !inPosArray(this.dangerPositions, this.start) &&
      inPosArray(this.dangerPositions, p)
    ) {
      return false;
    }

    return true;
  }

  countBoxHit(p: Position): number {
    return MapScanner.countBoxHit(p, this.map, this.power);
  }

  static countBoxHit(p: Position, map: MapArr, power: number): number {
    if (!MapScanner.passThrough(map, p)) {
      return 0;
    }
    let boxHit = 0;
    const rowColExtractors = [
      (i: number) => [p.row - i, p.col],
      (i: number) => [p.row + i, p.col],
      (i: number) => [p.row, p.col - i],
      (i: number) => [p.row, p.col + i],
    ];
    for (const extractor of rowColExtractors) {
      for (let i = 1; i <= power; i++) {
        const [nextRow, nextCol] = extractor(i);
        const np = map[nextRow][nextCol];
        if (np === MapCellType.Balk) {
          boxHit++;
          break;
        }
        if (!MapScanner.passThrough(map, {row: nextRow, col: nextCol})) {
          break;
        }
      }
    }
    return boxHit;
  }

  static hasHitTarget(
    p: Position,
    map: MapArr,
    power: number,
    targets: Position[],
  ): boolean {
    if (!targets.length) {
      return false;
    }

    const rowColExtractors = [
      (i: number) => [p.row - i, p.col],
      (i: number) => [p.row + i, p.col],
      (i: number) => [p.row, p.col - i],
      (i: number) => [p.row, p.col + i],
    ];
    for (const extractor of rowColExtractors) {
      for (let i = 1; i < power; i++) {
        const [nextRow, nextCol] = extractor(i);
        if (inPosArray(targets, {row: nextRow, col: nextCol})) {
          return true;
        }
        if (!MapScanner.passThrough(map, {row: nextRow, col: nextCol})) {
          break;
        }
      }
    }
    return false;
  }
}
