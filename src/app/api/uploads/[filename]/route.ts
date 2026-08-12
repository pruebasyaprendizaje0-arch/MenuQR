import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { promises as fs } from "fs";

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  // Extract and clean the filename to prevent path traversal
  const { filename } = params;
  const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, "");

  const filePath = join(process.cwd(), "public", "uploads", safeFilename);

  try {
    const fileBuffer = await fs.readFile(filePath);

    // Determine the mime-type
    let contentType = "application/octet-stream";
    const ext = safeFilename.split(".").pop()?.toLowerCase();
    if (ext === "png") {
      contentType = "image/png";
    } else if (ext === "jpg" || ext === "jpeg") {
      contentType = "image/jpeg";
    } else if (ext === "gif") {
      contentType = "image/gif";
    } else if (ext === "webp") {
      contentType = "image/webp";
    } else if (ext === "svg") {
      contentType = "image/svg+xml";
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return new NextResponse("File not found", { status: 404 });
  }
}
