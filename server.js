import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./utils/db.js";

import { expireNotificationsJob } from "./cron/expireNotifications.js";
import { expireBannersJob } from "./cron/expireBanners.js";
import { expireAnnouncementsJob } from "./cron/expireAnnouncements.js";

import announcementRoutes from "./routes/announcementRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import providerRoutes from "./routes/providerRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";
import showGameRoutes from "./routes/showGameRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import playlistRoutes from "./routes/playlistRoutes.js";
import deviceRoutes from "./routes/deviceRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";
import deviceMediaRoutes from "./routes/deviceMediaRoutes.js";
import outletRoutes from "./routes/outletRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";

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
  app.use("/api/media", mediaRoutes);
  app.use("/api/playlists", playlistRoutes);
  app.use("/api/devices", deviceRoutes);
  app.use("/api/deviceMedia", deviceMediaRoutes);
  app.use("/api/assignments", assignmentRoutes);
  app.use("/api/outlets", outletRoutes);
  app.use("/api/videos", videoRoutes);

  // Create HTTP server manually
  const server = http.createServer(app);

  // Attach WebSocket to same server
  createWebSocketServer(server);

  server.listen(PORT, () =>
    console.log(`Server + WebSocket running on port ${PORT}`),
  );
}

startServer();
