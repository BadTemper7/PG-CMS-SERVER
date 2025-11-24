import { WebSocketServer } from "ws";

let wss = null;

export function createWebSocketServer(server) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("Client connected to WebSocket");
    ws.send(JSON.stringify({ message: "Connected to WebSocket" }));
  });
}

export function broadcast(data) {
  if (!wss) return;

  const json = JSON.stringify(data);

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(json);
    }
  });
}
