import express from "express";
import {
  upsertDeviceMedia,
  listDeviceMedia,
  updateDeviceMedia,
  removeDeviceMedia,
  bulkAssignMediaToDevices,
  listAllDeviceMedia,
  bulkUpdateDeviceMediaForTargets,
  syncMediaTargets,
} from "../controllers/deviceMediaController.js";

const router = express.Router();

router.get("/", listAllDeviceMedia);
router.get("/:deviceId", listDeviceMedia);
router.post("/bulk", bulkAssignMediaToDevices);
router.post("/", upsertDeviceMedia);
router.patch("/:mediaId", bulkUpdateDeviceMediaForTargets);
router.put("/:mediaId/sync", syncMediaTargets);
router.patch("/:deviceId/:mediaId", updateDeviceMedia);
router.delete("/:deviceId/:mediaId", removeDeviceMedia);

export default router;
