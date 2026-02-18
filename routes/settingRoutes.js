// routes/settingRoutes.js
import express from "express";
import {
  getAllSettings,
  getSettingByKey,
  updateSetting,
  updateSettings,
  getTurnoverValue,
  updateTurnoverValue,
  getPromoDates,
  updatePromoDates,
} from "../controllers/settingController.js";

const router = express.Router();

// Public routes
router.get("/turnover", getTurnoverValue);
router.get("/promo-dates", getPromoDates);

// Protected/Admin routes
router.get("/", getAllSettings);
router.get("/:key", getSettingByKey);
router.put("/", updateSettings);
router.put("/:key", updateSetting);
router.put("/turnover", updateTurnoverValue);
router.put("/promo-dates", updatePromoDates);

export default router;
