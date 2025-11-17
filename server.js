import express from "express";
import mongoose from "mongoose";
import { connectDB } from "./utils/db.js";

const app = express();

app.get("/api/test-mongo", async (req, res) => {
  try {
    // Wait for the connection to complete
    await connectDB();

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

export default app;
