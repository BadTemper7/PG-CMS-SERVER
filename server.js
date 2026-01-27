import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./utils/db.js";

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

import path from "path";
import { fileURLToPath } from "url";

import http from "http";
import { createWebSocketServer } from "./wsServer.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
async function startServer() {
  await connectDB();

  // cron jobs
  expireNotificationsJob();
  expireBannersJob();
  expireAnnouncementsJob();
  startTerminalOfflineCheck();

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

  // Create HTTP server manually
  const server = http.createServer(app);

  // Attach WebSocket to same server
  createWebSocketServer(server);

  server.listen(PORT, () =>
    console.log(`Server + WebSocket running on port ${PORT}`),
  );
}

startServer();
