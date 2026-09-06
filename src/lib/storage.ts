import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB max

export function validateImageMagicBytes(buffer: Buffer, ext: string): boolean {
  if (ext === "jpg" || ext === "jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (ext === "png") {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (ext === "gif") {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    );
  }
  if (ext === "webp") {
    return (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }
  return false;
}

export interface IStorageProvider {
  saveFile(file: File | null): Promise<string | null>;
}

export class LocalStorageProvider implements IStorageProvider {
  async saveFile(file: File | null): Promise<string | null> {
    if (!file || file.size === 0 || !file.name) {
      return null;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      console.warn(`[Storage Upload] File size ${file.size} bytes exceeds limit of ${MAX_FILE_SIZE_BYTES} bytes.`);
      return null;
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.has(fileExt)) {
      console.warn(`[Storage Upload] Extension .${fileExt} is not allowed.`);
      return null;
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      console.warn(`[Storage Upload] MIME type ${file.type} is not in allowed list.`);
      return null;
    }

    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      if (!validateImageMagicBytes(buffer, fileExt)) {
        console.warn(`[Storage Upload] Magic bytes inspection failed for extension .${fileExt}`);
        return null;
      }

      const uploadDir = join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });

      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filename = `${Date.now()}-${cleanFileName}`;
      const filepath = join(uploadDir, filename);

      await writeFile(filepath, buffer);
      return `/uploads/${filename}`;
    } catch (error) {
      console.error("[Storage Upload Error]", error);
      return null;
    }
  }
}

export class S3StorageProvider implements IStorageProvider {
  async saveFile(_file: File | null): Promise<string | null> {
    throw new Error("S3StorageProvider is not configured yet. Set STORAGE_DRIVER=local.");
  }
}

export function getStorageProvider(): IStorageProvider {
  const driver = process.env.STORAGE_DRIVER || "local";
  if (driver === "s3") {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider();
}

export async function saveUploadedFile(file: File | null): Promise<string | null> {
  const provider = getStorageProvider();
  return provider.saveFile(file);
}
