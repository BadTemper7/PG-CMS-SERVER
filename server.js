import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import announcementRoutes from "./routes/announcementRoutes.js";
import { connectDB } from "./utils/db.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB().then(() => console.log("MongoDB connected"));

// Routes
app.use("/api/announcements", announcementRoutes);

// Export the app for Vercel serverless
export default app;
