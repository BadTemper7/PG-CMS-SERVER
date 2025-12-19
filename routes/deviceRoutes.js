import express from "express";
import {
  registerDevice,
  heartbeat,
  updatePlaybackStatus,
  getDeviceConfig,
  listDevices,
  resetDeviceToken,
} from "../controllers/deviceController.js";

const router = express.Router();

// Player/device
router.post("/register", registerDevice);
router.get("/:deviceId/config", getDeviceConfig);
router.post("/:deviceId/heartbeat", heartbeat);
router.post("/:deviceId/status", updatePlaybackStatus);
router.post("/:deviceId/reset-token", resetDeviceToken);

// Admin
router.get("/", listDevices);

export default router;
