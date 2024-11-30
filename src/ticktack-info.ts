export interface TicktackInfo {
  id: number;
  timestamp: number;
  tag: Tag;
  gameRemainTime: number;
  map_info: MapInfo;
  player_id: string;
}

interface MapInfo {
  size: MapInfoSize;
  players: MapPlayer[];
  map: MapCellType[][];
  bombs: Bomb[];
  spoils: Spoil[];
  weaponHammers: WeaponHammer[];
  weaponWinds: WeaponWind[];
  gameStatus: any;
  cellSize: number;
}

interface MapInfoSize {
  cols: number;
  rows: number;
}

interface MapPlayer {
  id: string;
  currentPosition: Position;
  spawnBegin: Position;
  score: number;
  lives: number;
  ownerWeapon: Weapon[];
  currentWeapon: Weapon;
  hasTransform: boolean;
  timeToUseSpecialWeapons: number;
  isStun: boolean;
  speed: number;
  power: number;
  delay: number;
  box: number;
  stickyRice: number;
  chungCake: number;
  nineTuskElephant: number;
  nineSpurRooster: number;
  nineManeHairHorse: number;
  holySpiritStone: number;
  eternalBadge: number;
  brickWall: number;
}

interface Position {
  col: number;
  row: number;
}

type Weapon = WoodenPestle | PhachThan;

type WoodenPestle = 1;
type PhachThan = 2;

interface Bomb {
  row: number;
  col: number;
  remainTime: number;
  playerId: number;
  power: number;
  createdAt: number;
}

interface Spoil {
  row: number;
  col: number;
  spoil_type: SpoilType;
}

type PlayerTag =
  | 'player:moving-banned'
  | 'player:start-moving'
  | 'player:stop-moving'
  | 'player:be-isolated'
  | 'player:back-to-playground'
  | 'player:pick-spoil'
  | 'player:stun-by-weapon'
  | 'player:stun-timeout';

type BombTag = 'bomb:exploded' | 'bomb:setup';

type GameTag = 'start-game' | 'update-data';

type WeddingTag =
  | 'player:into-wedding-room'
  | 'player:outto-wedding-room'
  | 'player:complete wedding';

type HammerTag = 'hammer:exploded';

type WoodenPestleTag = 'wooden-pestle:setup';

type WeaponWindTag = 'wind:exploded';

type Tag =
  | PlayerTag
  | BombTag
  | GameTag
  | WeddingTag
  | HammerTag
  | WoodenPestleTag
  | WeaponWindTag;

type MapEmptyCell = 0;
type MapWall = 1;
type MapBalk = 2;
type MapBrickWall = 3;
type MapPrisonPlace = 5;
type MapGodBadge = 6;
type MapCellDestroyed = 7;

type MapCellType =
  | MapEmptyCell
  | MapWall
  | MapBalk
  | MapBrickWall
  | MapPrisonPlace
  | MapGodBadge
  | MapCellDestroyed;

type SpoilType =
  | StickyRice
  | ChungCake
  | NineTuskElephant
  | NineSpurRooster
  | NineManeHairHorse
  | HolySpiritStone;

type StickyRice = 32;
type ChungCake = 33;
type NineTuskElephant = 34;
type NineSpurRooster = 35;
type NineManeHairHorse = 36;
type HolySpiritStone = 37;

interface WeaponHammer {
    playerId: string;
    power: number;
    destination: Position;
    createdAt: number;
}

interface WeaponWind {
    playerId: string;
    currentRow: number;
    currentCol: number;
    createdAt: number;
    destination: Position;
}