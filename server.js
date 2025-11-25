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

  // routes
  app.use("/api/announcements", announcementRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/banners", bannerRoutes);
  app.use("/api/providers", providerRoutes);
  app.use("/api/games", gameRoutes);
  app.use("/api/showGames", showGameRoutes);

  // Create HTTP server manually
  const server = http.createServer(app);

  // Attach WebSocket to same server
  createWebSocketServer(server);

  server.listen(PORT, () =>
    console.log(`Server + WebSocket running on port ${PORT}`)
  );
}

startServer();
