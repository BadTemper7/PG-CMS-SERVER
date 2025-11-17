import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import announcementRoutes from "./routes/announcementRoutes.js";
import { connectDB } from "./utils/db.js";
import notificationRoutes from "./routes/notificationRoutes.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

async function startServer() {
  await connectDB();

  app.use("/api/announcements", announcementRoutes);
  app.use("/api/notifications", notificationRoutes);

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer();
