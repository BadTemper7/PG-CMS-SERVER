import mongoose from "mongoose";

const outletSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true },

    siteValue: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("Outlet", outletSchema);
