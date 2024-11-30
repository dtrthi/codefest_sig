import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs';
import {join} from 'path';
import {Socket} from 'socket.io-client';
import {ClientConfig} from './client-config';
import {TicktackInfo} from './ticktack-info';

export class ClientConnection {
  constructor(
    public config: ClientConfig,
    public socket: Socket,
  ) {}

  init() {
    this.socket.on('join game', payload => {
      console.log(payload);
    });

    this.socket.on('ticktack player', function (payload: TicktackInfo) {});

    this.loadProfile();
  }

  loadProfile() {
    if (!this.config.profile) {
      return;
    }
    if (!existsSync('.profile')) {
      mkdirSync('.profile');
    }
    const profilePath = join('.profile', this.config.profile);
    if (existsSync(profilePath)) {
      const gameIdPath = join(profilePath, 'game-id.txt');
      if (existsSync(gameIdPath)) {
        const contents = readFileSync(gameIdPath);
        this.config.gameId = contents.toString().trim();
      }
      const playerIdPath = join(profilePath, 'player-id.txt');
      if (existsSync(playerIdPath)) {
        const contents = readFileSync(playerIdPath);
        this.config.playerId = contents.toString().trim();
      }
      console.log('Game id:', this.config.gameId);
      console.log('Player id:', this.config.playerId);
    } else {
      mkdirSync(profilePath);
    }
  }

  updateGameId(gameId: string) {
    if (!this.config.profile) {
      return;
    }
    if (!existsSync('.profile')) {
      mkdirSync('.profile');
    }
    const profilePath = join('.profile', this.config.profile);
    if (!existsSync(profilePath)) {
      mkdirSync(profilePath);
    }
    writeFileSync(join(profilePath, 'game-id.txt'), gameId);
    this.config.gameId = gameId;
  }

  updatePlayerId(playerId: string) {
    if (!this.config.profile) {
      return;
    }
    if (!existsSync('.profile')) {
      mkdirSync('.profile');
    }
    const profilePath = join('.profile', this.config.profile);
    if (!existsSync(profilePath)) {
      mkdirSync(profilePath);
    }
    writeFileSync(join(profilePath, 'player-id.txt'), playerId);
    this.config.playerId = playerId;
  }

  joinGame() {
    if (this.config.gameId && this.config.playerId) {
      this.socket.emit('join game', {
        game_id: this.config.gameId,
        player_id: this.config.playerId,
      });
    }
  }
}
