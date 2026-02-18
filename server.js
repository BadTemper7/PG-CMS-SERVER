import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./utils/db.js";
import http from "http";
import cron from "node-cron"; // Add node-cron import

import { expireNotificationsJob } from "./cron/expireNotifications.js";
import { expireBannersJob } from "./cron/expireBanners.js";
import { expireAnnouncementsJob } from "./cron/expireAnnouncements.js";
import { startTerminalOfflineCheck } from "./cron/checkTerminalsOffline.js";

import announcementRoutes from "./routes/announcementRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import providerRoutes from "./routes/providerRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";
import showGameRoutes from "./routes/showGameRoutes.js";
import outletRoutes from "./routes/outletRoutes.js";
import terminalRoutes from "./routes/terminalRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";
import outletVideoAssignmentRoutes from "./routes/outletVideoAssignmentRoutes.js";
import playbackRoutes from "./routes/playbackRoutes.js";
import terminalDetailsRoutes from "./routes/terminalDetailsRoutes.js";
import levelupRewardsRoutes from "./routes/levelUpRewardsRoutes.js";
import settingRoutes from "./routes/settingRoutes.js";
import { initializeSettings } from "./utils/initializeSettings.js";

import path from "path";
import { fileURLToPath } from "url";

import { createWebSocketServer } from "./wsServer.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

async function startServer() {
  await connectDB();
  await initializeSettings();

  // cron jobs
  expireNotificationsJob();
  expireBannersJob();
  expireAnnouncementsJob();
  startTerminalOfflineCheck();

  // Self-pinging cron job to keep server awake
  startSelfPingCron();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

  // routes
  app.use("/api/announcements", announcementRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/banners", bannerRoutes);
  app.use("/api/providers", providerRoutes);
  app.use("/api/games", gameRoutes);
  app.use("/api/showGames", showGameRoutes);
  app.use("/api/outlets", outletRoutes);
  app.use("/api/terminals", terminalRoutes);
  app.use("/api/videos", videoRoutes);
  app.use("/api/assignments", outletVideoAssignmentRoutes);
  app.use("/api/playback", playbackRoutes);
  app.use("/api/terminals", terminalDetailsRoutes);
  app.use("/api/levelup-rewards", levelupRewardsRoutes);
  app.use("/api/settings", settingRoutes);

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Root endpoint
  app.get("/", (req, res) => {
    res.json({
      message: "Server is running",
      timestamp: new Date().toISOString(),
      endpoints: [
        "/health - Health check",
        "/api/* - API endpoints",
        "/uploads/* - Static files",
      ],
    });
  });

  // Create HTTP server manually
  const server = http.createServer(app);

  // Attach WebSocket to same server
  createWebSocketServer(server);

  server.listen(PORT, () =>
    console.log(`Server + WebSocket running on port ${PORT}`),
  );
}

// Function to self-ping the server
function startSelfPingCron() {
  // Schedule self-ping every 10 minutes
  // Cron pattern: '*/10 * * * *' means every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    try {
      const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
      console.log(`[${new Date().toISOString()}] Self-pinging server...`);

      // Ping the health endpoint
      const response = await fetch(`${serverUrl}/health`);

      if (response.ok) {
        const data = await response.json();
        console.log(`Server ping successful:`, data);
      } else {
        console.log(`Server ping failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error during self-ping:", error.message);

      // If the server is running locally, try to ping localhost
      if (process.env.NODE_ENV !== "production") {
        try {
          const localResponse = await fetch(`http://localhost:${PORT}/health`);
          console.log(`Local ping result: ${localResponse.status}`);
        } catch (localError) {
          console.error("Local ping also failed:", localError.message);
        }
      }
    }
  });

  console.log("Self-ping cron job scheduled (every 10 minutes)");
}

// Alternative: Use setInterval for simpler implementation (without node-cron)
function startSelfPingInterval() {
  // Ping every 10 minutes (600000 milliseconds)
  const PING_INTERVAL = 10 * 60 * 1000;

  const pingServer = async () => {
    try {
      const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
      console.log(`[${new Date().toISOString()}] Self-pinging server...`);

      const response = await fetch(`${serverUrl}/health`);

      if (response.ok) {
        console.log(`Server ping successful`);
      } else {
        console.log(`Server ping failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error during self-ping:", error.message);
    }
  };

  // Initial ping
  pingServer();

  // Set up recurring ping
  setInterval(pingServer, PING_INTERVAL);

  console.log(
    `Self-ping interval scheduled (every ${PING_INTERVAL / 60000} minutes)`,
  );
}

startServer();
