import multer from "multer";
// import cloudinary from "../config/cloudinary.js";
import VideoSchema from "../models/Outlet.js";
const { Video, PromotionAssignment } = VideoSchema;

// Configure Cloudinary directly with YOUR credentials
import { v2 as cloudinary } from "cloudinary";

// HARDCODE YOUR CREDENTIALS HERE
cloudinary.config({
  cloud_name: "dhfy8flur",
  api_key: "835762477215963",
  api_secret: "8NMBGi-3gg_EzJX6sgimKhggkwM",
});

console.log("✅ Cloudinary configured with:");
console.log("   Cloud Name:", cloudinary.config().cloud_name);
console.log(
  "   API Key:",
  cloudinary.config().api_key ? "✅ Set" : "❌ Missing",
);

/* ---------------- multer (memory) ---------------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

export const uploadMiddleware = upload.single("file");

/* ---------------- upload helper ---------------- */
const uploadToCloudinary = (buffer, fileName) => {
  return new Promise((resolve, reject) => {
    console.log(`☁️ Uploading to Cloudinary folder: pg-cms/videos`);

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "pg-cms/videos", // Your folder
        public_id: `video_${Date.now()}`,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary error:", error.message);
          reject(error);
        } else {
          console.log("✅ Cloudinary upload successful!");
          console.log("   Public ID:", result.public_id);
          console.log("   URL:", result.secure_url);
          resolve(result);
        }
      },
    );

    stream.end(buffer);
  });
};

/* ---------------- controllers ---------------- */

// POST /api/videos/upload
export const uploadVideo = async (req, res) => {
  console.log("\n📤 VIDEO UPLOAD START\n");

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const file = req.file;
    const { name, description } = req.body;

    console.log("File:", file.originalname);
    console.log("Size:", (file.size / 1024 / 1024).toFixed(2), "MB");

    // Upload to Cloudinary
    const result = await uploadToCloudinary(file.buffer, file.originalname);

    // Save to database
    const video = await Video.create({
      name: name || file.originalname.replace(/\.[^/.]+$/, ""),
      description: description || "",
      cloudinaryUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      duration: 0,
      resolution: "Unknown",
      isActive: true,
    });

    console.log(`✅ Video saved with ID: ${video._id}`);
    console.log("📤 VIDEO UPLOAD SUCCESS\n");

    return res.status(201).json({
      success: true,
      message: "Video uploaded successfully",
      data: video,
    });
  } catch (error) {
    console.error("\n❌ UPLOAD ERROR:", error.message);

    if (error.message.includes("api_key")) {
      return res.status(500).json({
        success: false,
        message: "Cloudinary API key error",
        details: "Credentials not configured properly",
        fix: "Check hardcoded credentials in VideoController.js",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Upload failed",
      details: error.message,
    });
  }
};

// GET /api/videos
export const getVideos = async (req, res) => {
  try {
    const videos = await Video.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: videos });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/videos/:id
export const getVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).lean();
    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }
    return res.json({ success: true, data: video });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/videos/:id/active
export const setVideoActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    const isActive = active === true || active === "true" || active === 1;

    const video = await Video.findByIdAndUpdate(
      id,
      { isActive },
      { new: true },
    ).lean();

    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    return res.json({ success: true, message: "Success", data: video });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/videos/:id
export const updateVideo = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    const video = await Video.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    }).lean();

    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    return res.json({ success: true, message: "Updated", data: video });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/videos/:id
export const deleteVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    // Delete from Cloudinary
    if (video.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(video.cloudinaryPublicId, {
          resource_type: "video",
        });
      } catch (error) {
        console.error("Cloudinary delete error:", error.message);
      }
    }

    await Video.deleteOne({ _id: req.params.id });

    return res.json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/videos/cloudinary/test
export const testCloudinaryConnection = async (req, res) => {
  try {
    console.log("Testing Cloudinary connection...");

    // Test with a simple image upload
    const testResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        {
          folder: "pg-cms/test",
          public_id: `test_${Date.now()}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
    });

    // Clean up
    await cloudinary.uploader.destroy(testResult.public_id);

    return res.json({
      success: true,
      message: "Cloudinary working!",
      data: {
        config: {
          cloud_name: cloudinary.config().cloud_name,
          api_key: cloudinary.config().api_key ? "Set" : "Missing",
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Cloudinary test failed",
      error: error.message,
    });
  }
};
