// wsServer.js
import { WebSocketServer } from "ws";

let wss = null;

/**
 * Map deviceKey -> Set<WebSocket>
 * deviceKey can be deviceCode (e.g. OUTLET-A) or deviceMongoId (string)
 */
const clientsByDeviceKey = new Map();

function addClientToKey(deviceKey, ws) {
  if (!deviceKey) return;

  const key = String(deviceKey);
  if (!clientsByDeviceKey.has(key)) clientsByDeviceKey.set(key, new Set());
  clientsByDeviceKey.get(key).add(ws);

  ws.on("close", () => {
    const set = clientsByDeviceKey.get(key);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) clientsByDeviceKey.delete(key);
  });
}

export function createWebSocketServer(server) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");

    const deviceCode = url.searchParams.get("deviceCode"); // OUTLET-A
    const deviceMongoId = url.searchParams.get("deviceMongoId"); // 64fa...
    const token = url.searchParams.get("token"); // optional (you can validate if you want)

    const deviceKey = deviceCode || deviceMongoId || null;

    console.log("[WS] client connected", {
      deviceCode,
      deviceMongoId,
      tokenPresent: !!token,
    });

    if (deviceKey) addClientToKey(deviceKey, ws);

    ws.send(
      JSON.stringify({
        type: "WS_CONNECTED",
        deviceKey,
        message: "Connected to WebSocket",
      })
    );
  });
}

/** Broadcast to ALL connected clients */
export function broadcast(data) {
  if (!wss) return;

  const json = JSON.stringify(data);

  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(json);
  });
}

/** Send only to one device (deviceCode OR deviceMongoId) */
export function sendToDevice(deviceKey, data) {
  const set = clientsByDeviceKey.get(String(deviceKey));
  if (!set) return;

  const json = JSON.stringify(data);
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(json);
  }
}

/** Convenience: send to BOTH keys if you have both */
export function sendToDeviceBoth({ deviceCode, deviceMongoId }, data) {
  if (deviceCode) sendToDevice(deviceCode, data);
  if (deviceMongoId) sendToDevice(String(deviceMongoId), data);
}
