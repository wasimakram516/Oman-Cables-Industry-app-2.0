import mongoose from "mongoose";

const qrCodeSchema = new mongoose.Schema(
  {
    s3Key: { type: String, required: true },
    s3Url: { type: String, required: true },
    x: { type: Number, default: 50 },
    y: { type: Number, default: 50 },
    width: { type: Number, default: 20 },
    height: { type: Number, default: 20 },
  },
  { timestamps: true }
);

export default mongoose.models.QRCode || mongoose.model("QRCode", qrCodeSchema);