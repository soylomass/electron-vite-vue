import { WebSocketServer } from "./WebSocketServer";

const webSocketServer = new WebSocketServer();

export const initWebSocketServer = () => {
  webSocketServer.init();
};
