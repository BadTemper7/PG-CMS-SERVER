// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import announcementRoutes from "./routes/announcementRoutes.js";
import { connectDB } from "./utils/db.js";
import Announcement from "./models/Announcement.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
// app.use("/api/announcements", announcementRoutes);

app.get("/announcements", async (req, res) => {
  const announcements = await Announcement.find();
  res.json(announcements);
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
