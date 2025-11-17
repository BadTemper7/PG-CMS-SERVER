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

// Routes
app.use("/api/announcements", announcementRoutes);

// Connect to MongoDB
connectDB();

// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
export default app;
