import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
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
  {
    timestamps: true, // adds createdAt & updatedAt
  }
);

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
