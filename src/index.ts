import {io} from 'socket.io-client';
import {ClientConfig} from './client-config';
import {ClientConnection} from './client-connection';
import {createInterface} from 'readline';

const config: ClientConfig = {};
config.profile = process.argv[2] ?? 'profile1';
const socket = io('http://localhost');
const client = new ClientConnection(config, socket);
client.init();

(async () => {
  while (true) {
    console.log('Enter request: (connect, run, q)')
    for await (const command of createInterface({input: process.stdin})) {
      switch (command) {
        case 'game id':
          let gameId = null;
          console.log('Enter game id:');
          for await (const command of createInterface({input: process.stdin})) {
            gameId = command;
            break;
          }
          if (gameId) {
            client.updateGameId(gameId);
          }
          break;
        case 'player id':
          let playerId = null;
          console.log('Enter player id:');
          for await (const command of createInterface({input: process.stdin})) {
            playerId = command;
            break;
          }
          if (playerId) {
            client.updatePlayerId(playerId);
          }
          break;
        case 'c':
          client.joinGame();
          break;
        case 'q':
          process.exit();
        default:
          console.log(command);
      }
      break;
    }
  }
})();
