import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { promises as fs } from "fs";

export async function GET(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ filename: string }> }
) {
  const params = await paramsPromise;
  // Extract and clean the filename to prevent path traversal
  const { filename } = params;
  const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, "");

  const filePath = join(process.cwd(), "public", "uploads", safeFilename);

  try {
    const fileBuffer = await fs.readFile(filePath);

    // Allow only image formats expected from the upload pipeline.
    let contentType: string | undefined;
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

    if (!contentType) {
      return new NextResponse("File not found", { status: 404 });
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        // Old SVG uploads remain displayable but cannot execute script when opened directly.
        ...(ext === "svg" ? { "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:" } : {}),
      },
    });
  } catch {
    return new NextResponse("File not found", { status: 404 });
  }
}
