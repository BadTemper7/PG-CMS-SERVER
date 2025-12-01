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
  updateProviderOrder, // <-- add this
  switchProviderOrder,
} from "../controllers/providerController.js";

const router = express.Router();

// Reorder providers
router.put("/reorder", updateProviderOrder);

// Admin CRUD
router.post("/", createProvider);
router.get("/", getProviders);
router.get("/:id", getProviderById);
router.put("/:id", updateProvider);
router.patch("/:id/visibility", updateProviderVisibility);
router.post("/bulk-upload", bulkCreateProviders);
router.delete("/:id", deleteProvider);

// Bulk
router.post("/bulk-delete", deleteManyProviders);
router.put("/switch-order", switchProviderOrder);

export default router;
