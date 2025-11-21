import mongoose from "mongoose";

const providerSchema = new mongoose.Schema(
  {
    provider_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    directory: { type: String, required: true },
    darkLogo: { type: String },
    lightLogo: { type: String },
    image: { type: String, required: true },
    newGame: { type: Boolean, default: false },
    topGame: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    order: { type: Number, default: -1 },
  },
  { timestamps: true }
);

const Provider = mongoose.model("Provider", providerSchema);

export default Provider;
