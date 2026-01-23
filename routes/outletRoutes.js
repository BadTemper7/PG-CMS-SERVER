import express from "express";
import {
  createOutlet,
  getOutlets,
  getOutlet,
  updateOutlet,
  deleteOutlet,
  getOutletTerminals,
  getOutletVideos,
  assignVideoToOutlet,
  removeVideoAssignment,
  getOutletDashboard,
} from "../controllers/outletController.js";

const router = express.Router();

// Main outlet routes
router
  .route("/")
  .post(createOutlet) // Create outlet
  .get(getOutlets); // Get all outlets

router
  .route("/:id")
  .get(getOutlet) // Get single outlet
  .put(updateOutlet) // Update outlet
  .delete(deleteOutlet); // Delete outlet

// Outlet terminals
router.get("/:id/terminals", getOutletTerminals); // Get all terminals for outlet

// Outlet videos/promotions
router.get("/:id/videos", getOutletVideos); // Get all videos assigned to outlet
router.post("/:id/assign-video", assignVideoToOutlet); // Assign video to outlet
router.delete("/:outletId/videos/:assignmentId", removeVideoAssignment); // Remove video assignment

// Dashboard and analytics
router.get("/:id/dashboard", getOutletDashboard); // Get outlet dashboard with stats

export default router;
