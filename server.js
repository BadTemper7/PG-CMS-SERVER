import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import announcementRoutes from "./routes/announcementRoutes.js";
import { connectDB } from "./utils/db.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

await connectDB();

app.use("/api/announcements", announcementRoutes);
app.get("/", (req, res) => {
  res.send("Server is working properly.");
});
export default app;
