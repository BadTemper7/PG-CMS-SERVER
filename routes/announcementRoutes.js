import express from "express";
import {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  updateAnnouncementStatus,
  getActiveAnnouncements,
} from "../controllers/announcementController.js";

const router = express.Router();

// Public route - get active announcements
router.get("/public/active", getActiveAnnouncements);

// Admin routes
router.post("/", createAnnouncement);
router.get("/", getAnnouncements);
router.get("/:id", getAnnouncementById);
router.put("/:id", updateAnnouncement);
router.patch("/:id/status", updateAnnouncementStatus);
router.delete("/:id", deleteAnnouncement);

export default router;
