import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import QRCode from "@/models/QRCode";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { deleteFromS3 } from "@/utils/s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function GET() {
  try {
    await dbConnect();
    const qr = await QRCode.findOne();
    return NextResponse.json(qr || null);
  } catch (err) {
    console.error("❌ QR fetch error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const body = await req.json();

    if (body.presign) {
      const { fileName, fileType } = body;
      const key = `qrcodes/${Date.now()}-${fileName}`;
      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        ContentType: fileType,
      });
      const uploadURL = await getSignedUrl(s3, command, { expiresIn: 60 });

      return NextResponse.json({
        uploadURL,
        key,
        fileUrl: `${process.env.CLOUDFRONT_URL}/${key}`,
      });
    }

    const existingQR = await QRCode.findOne();
    if (existingQR) {
      await deleteFromS3(existingQR.s3Key);
      await QRCode.findByIdAndDelete(existingQR._id);
    }

    const qr = new QRCode(body);
    await qr.save();

    return NextResponse.json(qr, { status: 201 });
  } catch (err) {
    console.error("❌ QR create error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await dbConnect();
    const body = await req.json();
    const qr = await QRCode.findOne();

    if (!qr) {
      return NextResponse.json({ error: "QR not found" }, { status: 404 });
    }

    if (body.s3Key && body.s3Key !== qr.s3Key) {
      await deleteFromS3(qr.s3Key);
    }

    Object.assign(qr, body);
    await qr.save();

    return NextResponse.json(qr);
  } catch (err) {
    console.error("❌ QR update error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await dbConnect();
    const qr = await QRCode.findOne();

    if (!qr) {
      return NextResponse.json({ error: "QR not found" }, { status: 404 });
    }

    await deleteFromS3(qr.s3Key);
    await QRCode.findByIdAndDelete(qr._id);

    return NextResponse.json({ message: "QR deleted" });
  } catch (err) {
    console.error("❌ QR delete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}