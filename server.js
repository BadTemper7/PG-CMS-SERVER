// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import announcementRoutes from "./routes/announcementRoutes.js";
import { connectDB } from "./utils/db.js";

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
  const { status, activeOnly } = req.query;
  let filter = {};
  if (status) filter.status = status;
  if (activeOnly === "true") {
    filter.status = "active";
    filter.$or = [
      { expiry: { $exists: false } },
      { expiry: null },
      { expiry: { $gt: new Date() } },
    ];
  }
  const announcements = await Announcement.find(filter).sort({ createdAt: -1 });
  res.json(announcements);
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
