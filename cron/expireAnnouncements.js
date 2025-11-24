import cron from "node-cron";
import Announcement from "../models/Announcement.js";
import { broadcast } from "../wsServer.js";

export const expireAnnouncementsJob = () => {
  // Runs every day at midnight
  cron.schedule("0 0 * * *", async () => {
    const today = new Date();

    try {
      const result = await Announcement.updateMany(
        {
          expiry: { $lte: today },
          status: { $ne: "Expired" }, // update only Active or Hide
        },
        { status: "Expired" }
      );
      broadcast({
        type: "ANNOUNCEMENT_UPDATED",
        action: "expired",
      });
      console.log(`Expired announcement updated: ${result.modifiedCount}`);
    } catch (err) {
      console.error("Error auto-expiring announcement:", err);
    }
  });
};
