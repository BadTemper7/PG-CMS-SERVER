import Announcement from "../models/Announcement.js";

// Create a new announcement
export const createAnnouncement = async (req, res) => {
  try {
    const { desc, expiry, status = "active" } = req.body;

    // Validate required fields
    if (!desc) {
      return res.status(400).json({ error: "Description is required" });
    }

    const announcement = new Announcement({
      desc,
      expiry: expiry ? new Date(expiry) : undefined,
      status,
    });

    const savedAnnouncement = await announcement.save();
    res.status(201).json({
      message: "Announcement created successfully",
      announcement: savedAnnouncement,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all announcements with optional filtering
export const getAnnouncements = async (req, res) => {
  try {
    const { status, activeOnly } = req.query;

    let filter = {};

    // Filter by status if provided
    if (status) {
      filter.status = status;
    }

    // If activeOnly is true, get only active announcements that haven't expired
    if (activeOnly === "true") {
      filter.status = "active";
      filter.$or = [
        { expiry: { $exists: false } },
        { expiry: null },
        { expiry: { $gt: new Date() } },
      ];
    }

    const announcements = await Announcement.find(filter).sort({
      createdAt: -1,
    });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single announcement by ID
export const getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    res.json(announcement);
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(404).json({ error: "Announcement not found" });
    }
    res.status(500).json({ error: error.message });
  }
};

// Update an announcement
export const updateAnnouncement = async (req, res) => {
  try {
    const { desc, expiry, status } = req.body;

    const updateData = {};
    if (desc !== undefined) updateData.desc = desc;
    if (expiry !== undefined)
      updateData.expiry = expiry ? new Date(expiry) : null;
    if (status !== undefined) updateData.status = status;

    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    res.json({
      message: "Announcement updated successfully",
      announcement,
    });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(404).json({ error: "Announcement not found" });
    }
    res.status(500).json({ error: error.message });
  }
};

// Delete an announcement
export const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);

    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    res.json({ message: "Announcement deleted successfully" });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(404).json({ error: "Announcement not found" });
    }
    res.status(500).json({ error: error.message });
  }
};

// Update announcement status (active/hide)
export const updateAnnouncementStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !["active", "hide", "expired"].includes(status)) {
      return res.status(400).json({ error: "Valid status is required" });
    }

    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    res.json({
      message: "Announcement status updated successfully",
      announcement,
    });
  } catch (error) {
    if (error.kind === "ObjectId") {
      return res.status(404).json({ error: "Announcement not found" });
    }
    res.status(500).json({ error: error.message });
  }
};

// Get active announcements (for public use)
export const getActiveAnnouncements = async (req, res) => {
  try {
    const currentDate = new Date();

    const activeAnnouncements = await Announcement.find({
      status: "active",
      $or: [
        { expiry: { $exists: false } },
        { expiry: null },
        { expiry: { $gt: currentDate } },
      ],
    }).sort({ createdAt: -1 });

    res.json(activeAnnouncements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSampleResult = (req, res) => {
  res.send("this is working properly");
};
