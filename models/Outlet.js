import mongoose from "mongoose";

const outletSchema = new mongoose.Schema(
  {
    outletId: {
      type: String,
      required: true,
      unique: true,
    },
    location: { type: String, required: true },
    siteValue: { type: String, required: true },
    gameUrl: {
      type: String,
      default: function () {
        const gameSite = process.env.GAME_SITE || "sg8.casino";
        return `https://${gameSite}/agValue=${this.siteValue}`;
      },
    },
  },
  { timestamps: true },
);

const videoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    cloudinaryUrl: {
      type: String,
      required: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      default: 0,
    }, // in seconds, useful for tracking
    resolution: {
      type: String,
    }, // e.g., "1920x1080"
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const promotionAssignmentSchema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: true,
    },
    outletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Outlet",
      required: true,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    isExpired: {
      type: Boolean,
      default: function () {
        // Auto-expire if endDate is in the past
        if (this.endDate && this.endDate < new Date()) {
          return true;
        }
        return false;
      },
    },
    playOrder: {
      type: Number,
      default: 0,
    }, // For ordering videos in playlist
  },
  { timestamps: true },
);

const terminalSchema = new mongoose.Schema(
  {
    terminalNumber: {
      type: String,
      required: true,
    },
    terminalName: {
      type: String,
      default: function () {
        return `Terminal ${this.terminalNumber}`;
      },
    },
    outletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Outlet",
      required: true,
    },
    gameUrl: {
      type: String,
      default: function () {
        // This will be populated when the terminal is populated with outlet data
        return null;
      },
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date },
    status: {
      type: String,
      enum: ["offline", "online", "playing", "maintenance"],
      default: "offline",
    },
    lastPlaybackAt: { type: Date },
    currentVideo: {
      videoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Video",
      },
      startedAt: { type: Date },
    },
    settings: {
      volume: { type: Number, default: 80, min: 0, max: 100 },
      autoPlay: { type: Boolean, default: true },
      refreshInterval: { type: Number, default: 60, min: 10 }, // seconds
    },
  },
  { timestamps: true },
);

// Pre-save middleware to update isExpired
promotionAssignmentSchema.pre("save", function (next) {
  if (this.endDate && this.endDate < new Date()) {
    this.isExpired = true;
    this.isActive = false;
  }
  next();
});

// Create indexes for better query performance
promotionAssignmentSchema.index({ outletId: 1, isActive: 1, isExpired: 1 });
promotionAssignmentSchema.index({ videoId: 1, isActive: 1 });
terminalSchema.index({ outletId: 1, status: 1 });
terminalSchema.index({ tokenHash: 1 });

// Virtual field for terminal's gameUrl (better than default function)
terminalSchema.virtual("terminalGameUrl").get(function () {
  if (
    this.outletId &&
    typeof this.outletId === "object" &&
    this.outletId.siteValue
  ) {
    const gameSite = process.env.GAME_SITE || "sg8.casino";
    return `https://${gameSite}/agValue=${this.outletId.siteValue}`;
  }
  return `https://${process.env.GAME_SITE || "sg8.casino"}`;
});

// Ensure virtuals are included in JSON
terminalSchema.set("toJSON", { virtuals: true });
terminalSchema.set("toObject", { virtuals: true });

// Models with correct names
const Outlet = mongoose.model("Outlet", outletSchema);
const Video = mongoose.model("Video", videoSchema);
const PromotionAssignment = mongoose.model(
  "PromotionAssignment",
  promotionAssignmentSchema,
);
const Terminal = mongoose.model("Terminal", terminalSchema);

export default {
  Outlet,
  Video,
  PromotionAssignment,
  Terminal,
};