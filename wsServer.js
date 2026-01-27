// wsServer.js
import { WebSocketServer } from "ws";
import Terminal from "./models/Terminal.js";

let wss = null;
const clientsByDeviceKey = new Map();

// Track admin clients (for dashboard updates)
const adminClients = new Set();

function getKeySet(key) {
  const k = String(key);
  if (!clientsByDeviceKey.has(k)) clientsByDeviceKey.set(k, new Set());
  return clientsByDeviceKey.get(k);
}

export function createWebSocketServer(server) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");

    const deviceCode = url.searchParams.get("deviceCode"); // OUTLET-A
    const deviceMongoId = url.searchParams.get("deviceMongoId"); // 64fa...
    const token = url.searchParams.get("token"); // optional
    const isAdmin = url.searchParams.get("admin") === "true"; // Admin dashboard

    const deviceKey = deviceCode || deviceMongoId || null;

    console.log("[WS] client connected", {
      deviceCode,
      deviceMongoId,
      isAdmin,
      tokenPresent: !!token,
    });

    if (isAdmin) {
      // This is an admin dashboard client
      adminClients.add(ws);
      console.log("[WS] Admin client connected");

      // Send welcome message to admin
      ws.send(
        JSON.stringify({
          type: "WS_ADMIN_CONNECTED",
          message: "Connected as admin",
        }),
      );
    } else if (deviceKey) {
      // This is a terminal device client
      const set = getKeySet(deviceKey);
      const wasEmpty = set.size === 0;

      set.add(ws);

      // ✅ Mark terminal as online when first WebSocket connects
      if (wasEmpty) {
        Terminal.findOneAndUpdate(
          { deviceKey: deviceKey },
          {
            isOnline: true,
            lastSeenAt: new Date(),
          },
          { new: true },
        )
          .then((terminal) => {
            if (terminal) {
              // Broadcast to admin clients that terminal came online
              broadcastToAdmins({
                type: "TERMINAL_STATUS_UPDATE",
                data: {
                  terminalId: terminal._id,
                  isOnline: true,
                  lastSeenAt: terminal.lastSeenAt,
                  updatedAt: new Date(),
                },
              });
            }
          })
          .catch(console.error);

        broadcastToAdmins({
          type: "DEVICE_WS",
          action: "connected",
          deviceKey: deviceKey,
        });
      }

      ws.on("close", async () => {
        const setNow = clientsByDeviceKey.get(deviceKey);
        if (!setNow) return;

        setNow.delete(ws);

        // ✅ if no sockets left for that key => device truly disconnected
        if (setNow.size === 0) {
          clientsByDeviceKey.delete(deviceKey);

          // Mark terminal as offline immediately
          await Terminal.findOneAndUpdate(
            { deviceKey: deviceKey },
            {
              isOnline: false,
              lastSeenAt: new Date(),
            },
          )
            .then((terminal) => {
              if (terminal) {
                // Broadcast to admin clients that terminal went offline
                broadcastToAdmins({
                  type: "TERMINAL_STATUS_UPDATE",
                  data: {
                    terminalId: terminal._id,
                    isOnline: false,
                    lastSeenAt: terminal.lastSeenAt,
                    updatedAt: new Date(),
                  },
                });
              }
            })
            .catch(console.error);

          broadcastToAdmins({
            type: "DEVICE_WS",
            action: "disconnected",
            deviceKey: deviceKey,
          });
        }
      });
    }

    // Handle admin subscription requests
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "SUBSCRIBE_TERMINALS" && isAdmin) {
          // Admin wants to subscribe to terminal updates
          console.log("[WS] Admin subscribed to terminal updates");
          // Already added to adminClients set on connection
        }
      } catch (error) {
        console.error("[WS] Error parsing message:", error);
      }
    });

    ws.on("error", (error) => {
      console.error("[WS] WebSocket error:", error);
    });

    ws.send(
      JSON.stringify({
        type: "WS_CONNECTED",
        deviceKey,
        isAdmin,
        message: "Connected to WebSocket",
      }),
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

/** Broadcast only to admin clients */
export function broadcastToAdmins(data) {
  if (!wss) return;

  const json = JSON.stringify(data);

  adminClients.forEach((client) => {
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

/** Clean up admin client on disconnect */
export function removeAdminClient(ws) {
  adminClients.delete(ws);
}
