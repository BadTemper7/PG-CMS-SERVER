import express from "express";
import {
  getNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  deleteManyNotifications,
  markAsViewed,
} from "../controllers/notificationController.js";

const router = express.Router();

// ORDER MATTERS HERE:
router.get("/", getNotifications); // GET all
router.post("/bulk-delete", deleteManyNotifications);

router.post("/", createNotification);
router.put("/:id", updateNotification);
router.delete("/:id", deleteNotification);
router.get("/:id", getNotificationById); // GET one by ID
router.put("/viewed/:id", markAsViewed);

export default router;