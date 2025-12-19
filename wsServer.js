// wsServer.js
import { WebSocketServer } from "ws";

let wss = null;

/**
 * Map deviceKey -> Set<WebSocket>
 * deviceKey can be deviceCode (e.g. OUTLET-A) or deviceMongoId (string)
 */
const clientsByDeviceKey = new Map();

function getKeySet(key) {
  const k = String(key);
  if (!clientsByDeviceKey.has(k)) clientsByDeviceKey.set(k, new Set());
  return clientsByDeviceKey.get(k);
}

function addClientToKey(deviceKey, ws) {
  if (!deviceKey) return;

  const key = String(deviceKey);
  const set = getKeySet(key);

  // Track whether this was the first socket for this deviceKey
  const wasEmpty = set.size === 0;

  set.add(ws);

  // ✅ broadcast "connected" only when first socket for that deviceKey connects
  if (wasEmpty) {
    broadcast({ type: "DEVICE_WS", action: "connected", deviceKey: key });
  }

  ws.on("close", () => {
    const setNow = clientsByDeviceKey.get(key);
    if (!setNow) return;

    setNow.delete(ws);

    // ✅ if no sockets left for that key => device truly disconnected
    if (setNow.size === 0) {
      clientsByDeviceKey.delete(key);

      broadcast({ type: "DEVICE_WS", action: "disconnected", deviceKey: key });
    }
  });
}

export function createWebSocketServer(server) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");

    const deviceCode = url.searchParams.get("deviceCode"); // OUTLET-A
    const deviceMongoId = url.searchParams.get("deviceMongoId"); // 64fa...
    const token = url.searchParams.get("token"); // optional

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

/** ✅ Optional helper (if you want to use it in listDevices later) */
export function isDeviceConnected(deviceKey) {
  const set = clientsByDeviceKey.get(String(deviceKey));
  return !!set && set.size > 0;
}
