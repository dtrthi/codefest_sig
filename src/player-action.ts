import {ClientConnection} from './client-connection';
import {MapScanner} from './map-scanner';
import {PaceMeasurement} from './pace-measurement';
import {samePosition} from './position';
import {
  MapArr,
  MapCellType,
  PlayerInfo,
  Position,
  TicktackInfo,
} from './ticktack-info';

export class PlayerAction {
  private expectedPositions: Position[] = [];
  private lastPosition?: Position;
  private lastPositionTime = Date.now();
  private lastStop?: number;
  private gameStart: boolean = false;
  private counting: number = 0;

  private takeBrickWall = false;

  constructor(
    public info: PlayerInfo,
    private ticktack: TicktackInfo,
    private client: ClientConnection,
    private paceMeasurement: PaceMeasurement,
  ) {}

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
  }

  nextAction() {
    if (this.shouldWait()) {
      return;
    }
    this.gameStart = true;

    const nextAction = this.getNextAction();
    switch (nextAction) {
      case Actions.GoAround:
        const path = this.findNextTarget();
        if (path) {
          //client.drivePlayer(path.directions.map(d => d + 'b').join(''));
          this.client.drivePlayer(path.directions.join(''));
          this.expectedPositions = path.positions;
          if (path.nodes[path.nodes.length - 1].v === MapCellType.BrickWall) {
            this.takeBrickWall = true;
          }
          this.lastStop = undefined;
        }
        break;
      case Actions.TakeBrickWall:
        this.client.drivePlayer('b');
        this.wait();
        break;
      case Actions.Wait:
        this.wait();
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

    return Actions.GoAround;
  }

  findNextTarget() {
    if (!this.ticktack) {
      return;
    }
    const currentPos = this.info.currentPosition;
    const scanner = new MapScanner(
      this.ticktack.map_info.map,
      currentPos,
      (map: MapArr, p: Position) => {
        const getGodBadge =
          map[p.row][p.col] === MapCellType.GodBadge && !this.isGod();
        const getBrickWall = map[p.row][p.col] === MapCellType.BrickWall;
        const getBalk = this.isGod() && map[p.row][p.col] === MapCellType.Balk;

        return getGodBadge || getBrickWall || getBalk;
      },
    );
    return scanner.nextTarget();
  }

  wait() {
    this.lastStop = Date.now();
  }

  shouldWait(): boolean {
    if (this.expectedPositions.length || this.needToDelay()) {
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
    return true;
  }

  isAtGodBadge(): boolean {
    const currentPos = this.info.currentPosition;
    const map = this.ticktack?.map_info.map;
    if (
      map[currentPos.row][currentPos.col] === MapCellType.GodBadge
    ) {
      return true;
    }

    return false;
  }

  isGod() {
    return this.info.hasTransform;
  }
}

enum Actions {
  GoAround = 1,
  TakeBrickWall = 2,
  Wait,
}
