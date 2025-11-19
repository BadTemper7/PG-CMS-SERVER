import User from "../models/User.js";
import Banner from "../models/Banner.js";
// CREATE BANNER
export const createBanner = async (req, res) => {
  try {
    const { url, uploadedBy, expiry, status } = req.body;

    if (!url || !uploadedBy)
      return res
        .status(400)
        .json({ message: "URL and uploadedBy are required" });

    // Check user exists
    const userExists = await User.findById(uploadedBy);
    if (!userExists)
      return res.status(404).json({ message: "Uploader not found" });

    // Build banner data object
    const bannerData = {
      url,
      uploadedBy,
      status: status || "active", // ✅ FIXED: use incoming status
    };

    // Add expiry ONLY if provided
    if (expiry) bannerData.expiry = expiry;

    const banner = await Banner.create(bannerData);

    res.status(201).json({
      message: "Banner created successfully",
      banner,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET ALL BANNERS
export const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().populate(
      "uploadedBy",
      "username roles"
    );

    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedBanner = await Banner.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!updatedBanner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    return res.json({
      message: "Banner updated successfully",
      banner: updatedBanner,
    });
  } catch (err) {
    console.error("Update banner error:", err);
    return res.status(500).json({ message: "Failed to update banner" });
  }
};

/**
 * UPDATE BANNER STATUS ONLY (active, hide, expired)
 */
export const updateBannerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const banner = await Banner.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    console.log(id);
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    return res.json({
      message: "Banner status updated successfully",
      banner,
    });
  } catch (err) {
    console.error("Update banner status error:", err);
    return res.status(500).json({ message: "Failed to update banner status" });
  }
};

// DELETE BANNER
export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findByIdAndDelete(id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });

    res.json({ message: "Banner deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE MANY BANNERS
export const deleteManyBanners = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    const result = await Banner.deleteMany({ _id: { $in: ids } });

    return res.json({
      message: `${result.deletedCount} banners deleted successfully`,
    });
  } catch (err) {
    console.error("Bulk delete banner error:", err);
    return res.status(500).json({ message: "Bulk banner delete failed" });
  }
};
