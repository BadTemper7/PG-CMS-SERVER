import express from "express";
import {
  createTerminal,
  listTerminals,
  getTerminal,
  updateTerminal,
  removeTerminal,
  heartbeatTerminal,
  createMultipleTerminals,
} from "../controllers/terminalController.js";

const router = express.Router();

// create terminal under an outlet
router.post("/outlets/:outletId", createTerminal);
router.post("/:outletId/batch", createMultipleTerminals);

// list terminals (optional query: outletId, active)
router.get("/", listTerminals);

router.get("/:terminalId", getTerminal);
router.post("/heartbeat", heartbeatTerminal);
router.put("/:terminalId", updateTerminal);
router.delete("/:terminalId", removeTerminal);

export default router;
