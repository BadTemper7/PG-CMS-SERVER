import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./utils/db.js";
import announcementRoutes from "./routes/announcementRoutes.js";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use("/api/announcements", announcementRoutes);

// ✅ Test MongoDB connection route
app.get("/api/test-mongo", (req, res) => {
  try {
    const conn = mongoose.connection;

    if (conn.readyState === 1) {
      res.status(200).json({ message: "MongoDB is connected" });
    } else {
      res
        .status(500)
        .json({ message: "MongoDB not connected", state: conn.readyState });
    }
  } catch (err) {
    console.error("MongoDB test error:", err);
    res
      .status(500)
      .json({ message: "MongoDB connection failed", error: err.message });
  }
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
