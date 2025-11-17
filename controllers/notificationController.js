import Notification from "../models/Notification.js";

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

    const newNotification = await Notification.create({
      title,
      message,
      expiry: expiry || null,
      status: status || "active",
    });

    res.status(201).json({ notification: newNotification });
  } catch (err) {
    res.status(400).json({ error: "Failed to create notification" });
  }
};

// UPDATE NOTIFICATION
export const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    if (!updatedNotification)
      return res.status(404).json({ error: "Notification not found" });

    res.status(200).json({ notification: updatedNotification });
  } catch (err) {
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

    res.status(200).json({ message: "Notification deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: "Failed to delete notification" });
  }
};
