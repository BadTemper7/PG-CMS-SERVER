import express from "express";
import {
  createBanner,
  getAllBanners,
  updateBanner,
  deleteBanner,
  deleteManyBanners,
  updateBannerStatus,
  updateBannerTheme,
  updateBannerDevice,
} from "../controllers/bannerController.js";
const router = express.Router();

router.post("/", createBanner);
router.get("/", getAllBanners);
router.put("/:id", updateBanner);
router.patch("/:id/status", updateBannerStatus);
router.delete("/:id", deleteBanner);
router.post("/bulk-delete", deleteManyBanners);
router.patch("/:id/theme", updateBannerTheme);
router.patch("/:id/device", updateBannerDevice);

export default router;
