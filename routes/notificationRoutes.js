import express from "express";
import {
  getNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
} from "../controllers/notificationController.js";

const router = express.Router();

// ORDER MATTERS HERE:
router.get("/", getNotifications); // GET all
router.get("/:id", getNotificationById); // GET one by ID

router.post("/", createNotification);
router.put("/:id", updateNotification);
router.delete("/:id", deleteNotification);

export default router;
