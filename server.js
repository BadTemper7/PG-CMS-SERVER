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

// Connect to MongoDB and start server only after connection
const startServer = async () => {
  try {
    await connectDB();
    console.log("MongoDB connected");

    // Routes
    // app.use("/api/announcements", announcementRoutes);

    app.get("/announcements", async (req, res) => {
      try {
        const announcements = await Announcement.find().sort({ createdAt: -1 });
        res.json(announcements);
      } catch (err) {
        console.error("Error fetching announcements:", err);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
};

startServer();
