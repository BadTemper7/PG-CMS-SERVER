import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import announcementRoutes from "./routes/announcementRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/announcements", announcementRoutes);
// app.get("/", (req, res) => {
//   res.send("Server is working properly.");
// });
export default app;
