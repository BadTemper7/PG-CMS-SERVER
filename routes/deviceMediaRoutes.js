import express from "express";
import {
  upsertDeviceMedia,
  listDeviceMedia,
  updateDeviceMedia,
  removeDeviceMedia,
  bulkAssignMediaToDevices,
  listAllDeviceMedia,
} from "../controllers/deviceMediaController.js";

const router = express.Router();

router.get("/", listAllDeviceMedia);
router.post("/bulk", bulkAssignMediaToDevices);

router.post("/", upsertDeviceMedia);
router.get("/:deviceId", listDeviceMedia);
router.patch("/:deviceId/:mediaId", updateDeviceMedia);
router.delete("/:deviceId/:mediaId", removeDeviceMedia);

export default router;
