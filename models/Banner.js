import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, "URL is required"],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Uploader is required"],
    },
    expiry: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "hide", "expired"],
      default: "active",
    },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

const Banner = mongoose.model("Banner", bannerSchema);
export default Banner;
