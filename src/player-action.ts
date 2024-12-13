import {ClientConnection} from './client-connection';
import {MapScanner} from './map-scanner';
import {PaceMeasurement} from './pace-measurement';
import {inPosArray, samePosition, TreeNode} from './position';
import {
  Bomb,
  MapArr,
  MapCellType,
  PlayerInfo,
  Position,
  TicktackInfo,
  Weapon,
} from './ticktack-info';

export class PlayerAction {
  private expectedPositions: Position[] = [];
  private lastPosition?: Position;
  private lastPositionTime = Date.now();
  private lastStop?: number;
  private gameStart: boolean = false;
  private counting: number = 0;
  private nextAttack: boolean = false;

  private takeBrickWall = false;

  public nextPosition: Position;
  private mapState: MapState;

  public teamIds: string[] = [];

  private timeToMarry = Date.now();
  private enableRandomSelector: boolean = false;
  private delaySwitchingWeaponTime = Date.now();

  constructor(
    public info: PlayerInfo,
    public ticktack: TicktackInfo,
    private client: ClientConnection,
    private paceMeasurement: PaceMeasurement,
    private isChild: boolean,
  ) {
    this.nextPosition = info.currentPosition;
    this.mapState = new MapState(this);
  }

  consumeTicktack(payload: TicktackInfo) {
    this.ticktack = payload;
    if (this.expectedPositions.length) {
      const peek = this.expectedPositions[0];
      if (samePosition(peek, this.info.currentPosition)) {
        this.expectedPositions.shift();
        if (this.ticktack.tag !== 'player:start-moving') {
          if (this.paceMeasurement.justStart) {
            const lastPace = this.paceMeasurement.check();
            console.log(this.info.id, 'last pace', lastPace);
          }
          this.paceMeasurement.start();
        }
      }
    }

    if (
      !this.lastPosition ||
      !samePosition(this.lastPosition, this.info.currentPosition)
    ) {
      this.lastPosition = this.info.currentPosition;
      this.lastPositionTime = Date.now();
    }

    this.handleUnexpectedStop(() => {
      this.expectedPositions = [];
      this.lastPositionTime = Date.now();
      this.paceMeasurement.justStart = false;
    });

    // it wait too long
    if (this.lastPositionTime + 1000 < Date.now()) {
      this.expectedPositions = [];
      this.lastPositionTime = Date.now();
      this.paceMeasurement.justStart = false;
    }

    if (this.gameStart && !this.expectedPositions.length && !this.lastStop) {
      this.lastStop = Date.now();
    }

    if (this.isStartMoving() && this.expectedPositions.length) {
      this.nextPosition = this.expectedPositions[0];
      this.nextAttack = true;
    } else {
      this.nextPosition = this.info.currentPosition;
    }
    this.mapState = new MapState(this);
  }

  nextAction() {
    if (!this.isChild && this.timeToMarry + 30000 < Date.now()) {
      this.timeToMarry = Date.now();
      this.client.marryWife();
    }

    if (this.shouldWait()) {
      return;
    }
    this.gameStart = true;

    let path;
    const nextAction = this.getNextAction();
    console.log('next action', nextAction);
    switch (nextAction) {
      case Actions.GoAround:
        path = this.findNextTarget();
        if (path) {
          this.nextAttack = true;
          this.client.drivePlayer(path.directions.join(''), this.isChild);
          this.expectedPositions = path.positions;
          // if (path.nodes[path.nodes.length - 1].v === MapCellType.BrickWall) {
          //   this.takeBrickWall = true;
          // }
          this.lastStop = undefined;
        }
        break;
      case Actions.TakeBrickWall:
      case Actions.Attack:
        let fullPath = '';
        if (this.info.currentWeapon === Weapon.WoodenPestle) {
          fullPath = 'b';
        }
        if (
          this.info.currentWeapon === Weapon.PhachThan &&
          this.hasTargetToHit() &&
          !this.hitMembers() &&
          this.info.lives > 1
        ) {
          fullPath = 'b';
          const dangerPositions = MapState.getDangerPositions(
            this.info.currentPosition,
            this.ticktack.map_info.map,
            this.info.power,
          );
          this.mapState.addDangerPositions(dangerPositions);
        }
        path = this.findSafePlace();
        if (path) {
          fullPath += path.directions.join('');
          this.expectedPositions = path.positions;
          if (path.nodes[path.nodes.length - 1].v === MapCellType.BrickWall) {
            this.takeBrickWall = true;
          }
          this.lastStop = undefined;
        }
        if (path) {
          this.client.drivePlayer(fullPath, this.isChild);
        }
        this.wait();
        break;
      case Actions.Wait:
        this.wait();
        break;
      case Actions.SwitchWeapon:
        this.client.switchWeapon();
        break;
      case Actions.GoSafe:
        path = this.findSafePlace();
        if (path) {
          this.client.drivePlayer(path.directions.join(''), this.isChild);
          this.expectedPositions = path.positions;
          if (path.nodes[path.nodes.length - 1].v === MapCellType.BrickWall) {
            this.takeBrickWall = true;
          }
          this.lastStop = undefined;
        }
        break;
    }
  }

  getNextAction(): Actions {
    if (this.isSafe() && this.isAtGodBadge() && !this.isGod()) {
      return Actions.Wait;
    }
    if (this.takeBrickWall) {
      this.takeBrickWall = false;
      return Actions.TakeBrickWall;
    }

    if (this.indanger()) {
      return Actions.GoSafe;
    }

    if (this.expectedPositions.length) {
      return Actions.Wait;
    }

    // should switch to Wooden Pestle
    if (
      this.delaySwitchingWeaponTime + 500 < Date.now() &&
      this.info.currentWeapon === Weapon.PhachThan &&
      !this.mapState.canReachBalk()
    ) {
      this.delaySwitchingWeaponTime = Date.now();
      return Actions.SwitchWeapon;
    }

    // should switch to Phach Than
    if (
      this.delaySwitchingWeaponTime + 1000 < Date.now() &&
      this.info.currentWeapon === Weapon.WoodenPestle &&
      this.isGod() &&
      !this.hasBombsOnMap()
    ) {
      this.delaySwitchingWeaponTime = Date.now();
      return Actions.SwitchWeapon;
    }

    if (this.nextAttack && !this.expectedPositions.length) {
      this.nextAttack = false;
      return Actions.Attack;
    }

    return Actions.GoAround;
  }

  findNextTarget() {
    const currentPos = this.nextPosition;
    const scanner = new MapScanner(
      this.ticktack.map_info.map,
      currentPos,
      this.info.power,
      this.mapState.dangerPositions,
      [...this.mapState.memberPositions, ...this.mapState.oponentPositions],
      (map: MapArr, p: Position) => {
        return !inPosArray(this.mapState.dangerPositions, p);
        // const getGodBadge =
        //   map[p.row][p.col] === MapCellType.GodBadge && !this.isGod();
        // const getBrickWall = map[p.row][p.col] === MapCellType.BrickWall;
        // const getBalk = this.isGod() && map[p.row][p.col] === MapCellType.Balk;

        // return getGodBadge || getBrickWall || getBalk;
      },
    );
    if (this.isChild || this.enableRandomSelector || this.info.lives < 3) {
      return scanner.nextTarget();
    }
    return scanner.nextTarget((targets: TreeNode[]) =>
      this.priorityCheck(targets),
    );
  }

  findSafePlace() {
    const currentPos = this.nextPosition;
    const scanner = new MapScanner(
      this.ticktack.map_info.map,
      currentPos,
      this.info.power,
      this.mapState.dangerPositions,
      [...this.mapState.memberPositions, ...this.mapState.oponentPositions],
      (_map: MapArr, p: Position) => {
        return !inPosArray(this.mapState.dangerPositions, p);
      },
    );
    if (!this.isGod()) {
      return scanner.nextTarget((targets: TreeNode[]) =>
        this.priorityCheck(targets),
      );
    }
    if (this.info.lives > 3) {
      return scanner.nextTarget((targets: TreeNode[]) =>
        this.priorityCheck(targets),
      );
    }
    return scanner.nextTarget();
    // return scanner.nextTarget((targets: TreeNode[]) =>
    //   this.priorityCheck(targets),
    // );
  }

  wait() {
    this.lastStop = Date.now();
  }

  shouldWait(): boolean {
    if (
      !this.isStartMoving() &&
      (this.expectedPositions.length || this.needToDelay())
    ) {
      return true;
    }

    return false;
  }

  needToDelay(): boolean {
    // if (this.lastStop && this.lastStop + 4000 > Date.now()) {
    //   return true;
    // }

    return false;
  }

  handleUnexpectedStop(cb: () => void) {
    if (
      this.ticktack?.player_id === this.info.id &&
      this.ticktack?.tag === 'player:start-moving'
    ) {
      this.counting += 1;
    }
    if (
      this.ticktack?.player_id === this.info.id &&
      this.ticktack?.tag === 'player:stop-moving'
    ) {
      this.counting -= 1;
    }
    if (this.counting < 0) {
      console.log(this.info.id, 'encounter unexpected');
      this.counting = 0;
      cb();
    }
  }

  isSafe(): boolean {
    return !this.indanger();
  }

  isAtGodBadge(): boolean {
    const currentPos = this.info.currentPosition;
    const map = this.ticktack?.map_info.map;
    if (map[currentPos.row][currentPos.col] === MapCellType.GodBadge) {
      return true;
    }

    return false;
  }

  isGod() {
    return this.info.hasTransform || this.isChild;
  }

  isStartMoving(): boolean {
    return (
      this.ticktack.player_id === this.info.id &&
      this.ticktack.tag === 'player:start-moving'
    );
  }

  hasBombsOnMap(): boolean {
    return !!this.ticktack.map_info.bombs.find(
      bomb => bomb.playerId === this.info.id,
    );
  }

  indanger(): boolean {
    return inPosArray(this.mapState.dangerPositions, this.nextPosition);
  }

  priorityCheck(nodes: TreeNode[]): TreeNode {
    let balkHit: TreeNode | undefined;
    let godBadgeNode: TreeNode | undefined;

    for (const node of nodes) {
      if (
        !this.isGod() &&
        this.ticktack.map_info.map[node.p.row][node.p.col] ===
          MapCellType.GodBadge
      ) {
        return node;
      }

      if (
        !this.isGod() &&
        this.ticktack.map_info.map[node.p.row][node.p.col] ===
          MapCellType.BrickWall
      ) {
        return node;
      }

      // if (node.distance > 10) {
      //   continue;
      // }
      if (this.isGod() && inPosArray(this.mapState.spoilPositions, node.p)) {
        return node;
      }

      if (node.hitBox && (!balkHit || balkHit.hitBox < node.hitBox)) {
        balkHit = node;
      }
    }

    return godBadgeNode || balkHit || nodes[nodes.length - 1];
  }

  firstSafePlace(nodes: TreeNode[]): TreeNode {
    for (const node of nodes) {
      if (
        !inPosArray(this.mapState.dangerPositions, node.p) &&
        MapScanner.passThrough(this.ticktack.map_info.map, node.p)
      ) {
        return node;
      }
    }

    return nodes[nodes.length - 1];
  }

  hasTargetToHit(): boolean {
    if (
      MapScanner.countBoxHit(
        this.info.currentPosition,
        this.ticktack.map_info.map,
        this.info.power,
      ) > 0 ||
      MapScanner.hasHitTarget(
        this.info.currentPosition,
        this.ticktack.map_info.map,
        this.info.power,
        this.mapState.oponentPositions,
      )
    ) {
      return true;
    }

    return false;
  }

  hitMembers(): boolean {
    return MapScanner.hasHitTarget(
      this.info.currentPosition,
      this.ticktack.map_info.map,
      this.info.power,
      this.mapState.memberPositions,
    );
  }
}

enum Actions {
  GoAround = 'go',
  TakeBrickWall = 'destroy',
  Wait = 'wait',
  SwitchWeapon = 'switch',
  GoSafe = 'safe',
  Attack = 'attack',
}

class MapState {
  private reachBalk: boolean = false;
  public bombPositions: Position[] = [];
  public dangerPositions: Position[] = [];
  public spoilPositions: Position[] = [];
  public memberPositions: Position[] = [];
  public oponentPositions: Position[] = [];

  constructor(private playerAction: PlayerAction) {
    const map = playerAction.ticktack.map_info.map;
    for (const bomb of playerAction.ticktack.map_info.bombs) {
      this.bombPositions.push({row: bomb.row, col: bomb.col});
      this.dangerPositions = [
        ...this.dangerPositions,
        ...this.getDangerPositions(bomb, playerAction.ticktack.map_info.map),
      ];
    }
    for (const spoil of playerAction.ticktack.map_info.spoils) {
      this.spoilPositions.push({row: spoil.row, col: spoil.col});
    }
    for (const player of playerAction.ticktack.map_info.players) {
      if (playerAction.teamIds.includes(player.id)) {
        if (playerAction.info.id !== player.id) {
          this.memberPositions.push(player.currentPosition);
        }
      } else {
        this.oponentPositions.push(player.currentPosition);
      }
    }
    const mapScanner = new MapScanner(
      map,
      playerAction.nextPosition,
      playerAction.info.power,
      this.dangerPositions,
      [...this.memberPositions, ...this.oponentPositions],
      (map: MapArr, p: Position) => {
        if (map[p.row][p.col] === MapCellType.Balk) {
          this.reachBalk = true;
        }
        return true;
      },
    );
  }

  addDangerPositions(positions: Position[]) {
    this.bombPositions = [...this.bombPositions, ...positions];
  }

  canReachBalk(): boolean {
    return this.reachBalk;
  }

  getDangerPositions(bomb: Bomb, map: MapArr): Position[] {
    return MapState.getDangerPositions(
      {row: bomb.row, col: bomb.col},
      map,
      bomb.power,
    );
  }

  static getDangerPositions(
    p: Position,
    map: MapArr,
    power: number,
  ): Position[] {
    const positions: Position[] = [p];
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
        if (np !== MapCellType.EmptyCell && np !== MapCellType.GodBadge) {
          break;
        }
        positions.push({row: nextRow, col: nextCol});
      }
    }

    return positions;
  }
}
