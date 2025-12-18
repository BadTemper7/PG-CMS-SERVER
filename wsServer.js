import { WebSocketServer } from "ws";

let wss = null;

/**
 * Map deviceKey -> Set<WebSocket>
 * deviceKey will be your device code (Device.deviceId) OR mongo id (string)
 */
const clientsByDeviceKey = new Map();

function addClientToKey(deviceKey, ws) {
  if (!deviceKey) return;

  if (!clientsByDeviceKey.has(deviceKey)) {
    clientsByDeviceKey.set(deviceKey, new Set());
  }

  clientsByDeviceKey.get(deviceKey).add(ws);

  ws.on("close", () => {
    const set = clientsByDeviceKey.get(deviceKey);
    if (!set) return;

    set.delete(ws);
    if (set.size === 0) clientsByDeviceKey.delete(deviceKey);
  });
}

export function createWebSocketServer(server) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    // Allow device to pass identity via query:
    // ws://host:port/?deviceCode=OUTLET-A
    // ws://host:port/?deviceMongoId=64fa...
    const url = new URL(req.url, "http://localhost");
    const deviceCode = url.searchParams.get("deviceCode");
    const deviceMongoId = url.searchParams.get("deviceMongoId");

    const deviceKey = deviceCode || deviceMongoId || null;

    console.log("WS client connected", { deviceCode, deviceMongoId });

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

/** Broadcast to ALL clients (useful for admin dashboards) */
export function broadcast(data) {
  if (!wss) return;

  const json = JSON.stringify(data);

  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(json);
  });
}

/** ✅ Send only to a specific device key (deviceCode OR deviceMongoId) */
export function sendToDevice(deviceKey, data) {
  if (!deviceKey) return;

  const set = clientsByDeviceKey.get(String(deviceKey));
  if (!set) return;

  const json = JSON.stringify(data);

  for (const ws of set) {
    if (ws.readyState === 1) ws.send(json);
  }
}

/** ✅ Optional helper: send to both code + mongo id if you have both */
export function sendToDeviceBoth({ deviceCode, deviceMongoId }, data) {
  if (deviceCode) sendToDevice(deviceCode, data);
  if (deviceMongoId) sendToDevice(String(deviceMongoId), data);
}
