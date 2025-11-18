// cron/expireBanners.js
import cron from "node-cron";
import Banner from "../models/Banner.js";

export const expireBannersJob = () => {
  // Runs every day at midnight
  cron.schedule("0 0 * * *", async () => {
    const today = new Date();

    try {
      const result = await Banner.updateMany(
        {
          expiry: { $lte: today },
          status: { $ne: "Expired" }, // update only Active or Hide
        },
        { status: "Expired" }
      );

      console.log(`Expired banners updated: ${result.modifiedCount}`);
    } catch (err) {
      console.error("Error auto-expiring banners:", err);
    }
  });
};
