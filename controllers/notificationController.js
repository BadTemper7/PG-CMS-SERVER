import Notification from "../models/Notification.js";
import { broadcast } from "../wsServer.js";

// GET ALL NOTIFICATIONS
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.status(200).json(notifications);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// GET ONE
export const getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification)
      return res.status(404).json({ error: "Notification not found" });

    res.status(200).json(notification);
  } catch (err) {
    res.status(400).json({ error: "Invalid ID format" });
  }
};

// CREATE NEW NOTIFICATION
export const createNotification = async (req, res) => {
  try {
    const { title, message, expiry, status } = req.body;

    // ===== DATE VALIDATION (NO TIMEZONE BUGS) =====
    if (expiry) {
      // expiry must be YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
        return res.status(400).json({ error: "Invalid expiry date format" });
      }

      // Convert expiry safely — NO timezone shifts
      const [year, month, day] = expiry.split("-").map(Number);
      const expDate = new Date(Date.UTC(year, month - 1, day));

      if (isNaN(expDate.getTime())) {
        return res.status(400).json({ error: "Invalid expiry date" });
      }

      // Today's date (UTC, no time)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      if (expDate < today) {
        return res
          .status(400)
          .json({ error: "Expiry date cannot be earlier than today" });
      }
    }

    // ===== CREATE ONLY IF VALID =====
    const newNotification = await Notification.create({
      title,
      message,
      expiry: expiry || null,
      status: status || "active",
    });

    broadcast({
      type: "NOTIFICATION_UPDATED",
      action: "create",
      newNotification,
    });
    res.status(201).json({
      message: "Notification created successfully",
      notification: newNotification,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to create notification" });
  }
};

// UPDATE NOTIFICATION
export const updateNotification = async (req, res) => {
  try {
    const { expiry } = req.body;

    // ===== DATE VALIDATION =====
    if (expiry) {
      // Must be YYYY-MM-DD format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
        return res.status(400).json({ error: "Invalid expiry date format" });
      }

      // Convert expiry string WITHOUT timezone issues
      const [year, month, day] = expiry.split("-").map(Number);
      const expDate = new Date(Date.UTC(year, month - 1, day));

      if (isNaN(expDate.getTime())) {
        return res.status(400).json({ error: "Invalid expiry date" });
      }

      // Today's date in UTC (no time)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Reject dates earlier than today
      if (expDate < today) {
        return res
          .status(400)
          .json({ error: "Expiry date cannot be earlier than today" });
      }
    }

    // ===== UPDATE =====
    const updatedNotification = await Notification.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedNotification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    broadcast({
      type: "NOTIFICATION_UPDATED",
      action: "UPDATE",
      updatedNotification,
    });
    res.status(200).json({
      message: "Notification updated successfully",
      notification: updatedNotification,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to update notification" });
  }
};

// DELETE NOTIFICATION
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Notification.findByIdAndDelete(id);

    if (!deleted)
      return res.status(404).json({ error: "Notification not found" });
    broadcast({
      type: "NOTIFICATION_UPDATED",
      action: "delete",
      deleted,
    });
    res.status(200).json({ message: "Notification deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: "Failed to delete notification" });
  }
};

// DELETE MANY NOTIFICATIONS
export const deleteManyNotifications = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    const result = await Notification.deleteMany({ _id: { $in: ids } });
    broadcast({
      type: "NOTIFICATION_UPDATED",
      action: "delete",
      result,
    });
    return res.json({
      message: `${result.deletedCount} notifications deleted successfully`,
    });
  } catch (err) {
    console.error("Bulk delete error:", err);
    return res.status(500).json({ message: "Bulk delete failed" });
  }
};
