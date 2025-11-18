import User from "../models/User.js";
import Banner from "../models/Banner.js";
// CREATE BANNER
export const createBanner = async (req, res) => {
  try {
    const { url, uploadedBy, expiry } = req.body;

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
      status: "Active",
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

// UPDATE BANNER STATUS
export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Active", "Hide", "Expired"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const banner = await Banner.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!banner) return res.status(404).json({ message: "Banner not found" });

    res.json({ message: "Status updated", banner });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
