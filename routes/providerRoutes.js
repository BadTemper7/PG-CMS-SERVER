import express from "express";
import {
  createProvider,
  getProviders,
  getProviderById,
  updateProvider,
  deleteProvider,
  deleteManyProviders,
  updateProviderVisibility,
  bulkCreateProviders,
} from "../controllers/providerController.js";

const router = express.Router();

// Admin
router.post("/", createProvider);
router.get("/", getProviders);
router.get("/:id", getProviderById);
router.put("/:id", updateProvider);
router.patch("/:id/visibility", updateProviderVisibility);
router.post("/bulk-upload", bulkCreateProviders);
router.delete("/:id", deleteProvider);

// Bulk
router.post("/bulk-delete", deleteManyProviders);

export default router;
