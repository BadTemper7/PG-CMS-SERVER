import express from "express";
import {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  updateAnnouncementStatus,
  getActiveAnnouncements,
  getSampleResult,
} from "../controllers/announcementController.js";

import { connectDB } from "../utils/db.js";

const router = express.Router();

// Ensure DB is connected before handling requests
router.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Public route
router.get("/public/active", getActiveAnnouncements);

// Admin routes
router.post("/", createAnnouncement);
router.get("/", getAnnouncements);
router.get("/:id", getAnnouncementById);
router.put("/:id", updateAnnouncement);
router.patch("/:id/status", updateAnnouncementStatus);
router.delete("/:id", deleteAnnouncement);

router.get("/public", (req, res) => {
  res.send("Server is working properly.");
});

export default router;
