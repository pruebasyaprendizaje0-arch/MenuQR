import { prismaTenant, prismaControl } from "@/lib/db";
import { validateImageMagicBytes } from "@/lib/storage";
import { parseDishImages, serializeDishImages } from "@/lib/dish-images";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as XLSX from "xlsx";

// ============================================================================
// CONSTANTES Y LÍMITES DE SEGURIDAD (ANTI-BOMBA ZIP, ZIP64, SYMLINKS, ENCRIPTACIÓN)
// ============================================================================
export const MAX_ZIP_FILE_SIZE = 100 * 1024 * 1024; // 100 MB max archivo ZIP
export const MAX_TOTAL_UNCOMPRESSED_SIZE = 300 * 1024 * 1024; // 300 MB max total descomprimido
export const MAX_ZIP_ENTRIES = 1500; // Máximo número de archivos en el zip
export const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB máx por imagen individual

// ============================================================================
// IMPLEMENTACIÓN COMPATIBLE DE CRC32 (IEEE 802.3)
// Garantiza funcionamiento idéntico en Node 20 (Dockerfile / engines) y Node 22+
// ============================================================================
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

export function computeCrc32(buf: Buffer): number {
  if (typeof (zlib as any).crc32 === "function") {
    return ((zlib as any).crc32(buf) >>> 0);
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ============================================================================
// RESOLUCIÓN DE RUTAS LOCALES Y PROTECCIÓN ANTI-SSRF / MULTI-DOMINIO
// ============================================================================

/**
 * Determina si una URL o ruta apunta al almacenamiento local /uploads/.
 * Reconoce:
 * - Rutas relativas que comienzan con /uploads/ o uploads/
 * - URLs absolutas cuyo host/origen corresponda al almacenamiento propio confirmado:
 *   - menuqr.ubicame.cc
 *   - ubicame.cc
 *   - process.env.APP_URL
 *   - process.env.NEXT_PUBLIC_APP_URL
 *   - localhost / 127.0.0.1
 * NO asume que subdominios ajenos (ej. reservaciones.ubicame.cc) comparten disco.
 * NO realiza peticiones HTTP de red bajo ninguna circunstancia.
 */
export function resolveLocalStorageRelativePath(urlStr: string | null | undefined): string | null {
  if (!urlStr || typeof urlStr !== "string") return null;
  const trimmed = urlStr.trim();
  if (!trimmed) return null;

  // 1. Ruta relativa directa
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("uploads/")) {
    const rawRel = trimmed.replace(/^\/?uploads\//, "");
    try {
      return decodeURIComponent(rawRel);
    } catch {
      return rawRel;
    }
  }

  // 2. URL absoluta
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      const port = parsed.port;
      const hostWithPort = port ? `${host}:${port}` : host;

      const allowedHosts = new Set<string>(["menuqr.ubicame.cc", "ubicame.cc", "localhost", "127.0.0.1"]);

      if (process.env.APP_URL) {
        try {
          const appUrlParsed = new URL(process.env.APP_URL);
          allowedHosts.add(appUrlParsed.hostname.toLowerCase());
        } catch { }
      }
      if (process.env.NEXT_PUBLIC_APP_URL) {
        try {
          const publicUrlParsed = new URL(process.env.NEXT_PUBLIC_APP_URL);
          allowedHosts.add(publicUrlParsed.hostname.toLowerCase());
        } catch { }
      }

      // Validar si el host pertenece al almacenamiento propio confirmado
      if (!allowedHosts.has(host) && !allowedHosts.has(hostWithPort)) {
        return null; // Dominio ajeno o no confirmado
      }

      // Validar que el pathname comience estrictamente con /uploads/
      const pathname = parsed.pathname;
      if (!pathname.startsWith("/uploads/")) {
        return null;
      }

      const rawRel = pathname.replace(/^\/uploads\//, "");
      try {
        return decodeURIComponent(rawRel);
      } catch {
        return rawRel;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Valida que la ruta resuelta permanezca estrictamente dentro de public/uploads,
 * incluso tras decodificarla y resolver enlaces simbólicos (realpath).
 */
export async function validateAndResolveSafeDiskPath(cleanRelPath: string): Promise<string | null> {
  if (!cleanRelPath || cleanRelPath.includes("\0")) return null;

  const normalized = cleanRelPath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  for (const seg of segments) {
    if (seg === ".." || seg === "." || seg === "") return null;
  }

  const uploadRootDir = path.resolve(process.cwd(), "public", "uploads");
  const candidatePath = path.resolve(uploadRootDir, cleanRelPath);

  if (!candidatePath.startsWith(uploadRootDir + path.sep) && candidatePath !== uploadRootDir) {
    return null;
  }

  try {
    const realCandidate = await fs.realpath(candidatePath);
    const realUploadDir = await fs.realpath(uploadRootDir).catch(() => uploadRootDir);
    if (!realCandidate.startsWith(realUploadDir + path.sep) && realCandidate !== realUploadDir) {
      return null;
    }
    const stat = await fs.stat(realCandidate);
    if (!stat.isFile()) return null;
    return realCandidate;
  } catch {
    return null;
  }
}

// ============================================================================
// TIPOS Y MODELOS DE DATOS DEL RESPALDO VERSIONADO
// ============================================================================
export interface BackupManifest {
  version: "1.0.0";
  schemaVersion: 1;
  packageId: string;
  exportedAt: string;
  sourceRestaurant: {
    id: string;
    name: string;
    slug: string;
    businessType: string;
    catalogMode: string;
    plan: string;
    themeColor: string;
  };
  counts: {
    categories: number;
    dishes: number;
    modifierGroups: number;
    modifierOptions: number;
    campaigns: number;
    whatsappTemplates: number;
    seasonRates: number;
    coupons: number;
    hasRuletaConfig: boolean;
    hasDatilProfile: boolean;
  };
  photos: {
    totalReferenced: number;
    included: number;
    missing: string[];
    external: string[];
  };
  reconnectionItems: string[];
  isComplete: boolean;
  warnings: string[];
}

export interface BusinessDataBackup {
  manifest: BackupManifest;
  identity: {
    name: string;
    slug: string;
    businessType: string;
    catalogMode: string;
    themeColor: string;
    slogan: string | null;
    description: string | null;
    specialty: string | null;
    services: string | null;
    tablesConfig: string;
    customLabels: string | null;
    plan: string;
    priceRange: string | null;
    testMode: boolean;
  };
  location: {
    country: string | null;
    province: string | null;
    city: string | null;
    parish: string | null;
    sector: string | null;
    neighborhood: string | null;
    postalCode: string | null;
    address: string | null;
    locality: string | null;
    latitude: number | null;
    longitude: number | null;
    mapEmbedUrl: string | null;
  };
  schedules: {
    schedule: string | null;
    localSchedule: string | null;
    deliverySchedule: string | null;
    blockedDates: string | null;
    structuredSchedule: string | null;
  };
  orderingAndDelivery: {
    enableTableOrdering: boolean;
    enableDelivery: boolean;
    enablePickup: boolean;
    ivaPercent: number;
    servicePercent: number;
    deliveryCost: number;
    deliveryEnabled: boolean;
    deliveryRates: string | null;
    ivaOnTable: boolean;
    ivaOnTakeout: boolean;
    serviceOnTable: boolean;
    serviceOnTakeout: boolean;
  };
  contactAndSocial: {
    whatsapp: string;
    contactNumbers: string | null;
    instagram: string | null;
    facebook: string | null;
    tiktok: string | null;
    ubicameUrl: string | null;
    reservationUrl: string | null;
    googleBusinessUrl: string | null;
  };
  seo: {
    seoTitle: string | null;
    seoDescription: string | null;
    seoKeywords: string | null;
    customFaq: string | null;
  };
  bankingNonSecret: {
    bankName: string | null;
    bankAccountType: string | null;
    bankAccountNumber: string | null;
    bankAccountName: string | null;
    bankAccountDocument: string | null;
    bankAccountEmail: string | null;
    deunaPhone: string | null;
    payphonePhone: string | null;
    payphoneUrl: string | null;
  };
  brandingPhotos: {
    logoUrl: string | null;
    coverUrl: string | null;
    qrCobroUrl: string | null;
    payphoneQrUrl: string | null;
    seoImage: string | null;
  };
  categories: Array<{
    id: string;
    name: string;
    order: number;
    imageAspectRatio: string | null;
  }>;
  dishes: Array<{
    id: string;
    categoryId: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
    isAvailable: boolean;
    sku: string | null;
    barcode: string | null;
    costPrice: number | null;
    stock: number | null;
    minStock: number | null;
    trackStock: boolean;
    isService: boolean;
    vatRate: string;
    hasIce: boolean;
    variants: string | null;
    isSuggested: boolean;
    supplierName?: string | null;
    modifierGroups: Array<{
      id: string;
      name: string;
      minSelect: number;
      maxSelect: number;
      options: Array<{
        id: string;
        name: string;
        extraPrice: number;
      }>;
    }>;
  }>;
  campaigns: Array<{
    id: string;
    title: string;
    type: string;
    badgeText: string | null;
    description: string | null;
    imageUrl: string | null;
    startDate: string | null;
    endDate: string | null;
    eventDate: string | null;
    startTime: string | null;
    endTime: string | null;
    daysOfWeek: string | null;
    discountType: string;
    discountValue: number | null;
    ctaType: string;
    ctaText: string | null;
    whatsappMessage: string | null;
    externalUrl: string | null;
    isActive: boolean;
    showInProfile: boolean;
    showInCatalog: boolean;
    order: number;
    dishIds: string[];
  }>;
  ruletaConfig: {
    activa: boolean;
    titulo: string;
    descripcion: string;
    colorPrimario: string;
    colorSecundario: string;
    colorFondo: string;
    premios: string;
    limiteDiasReGiro: number;
    maxGirosIpDia: number;
    expiracionHoras: number;
  } | null;
  whatsappTemplates: Array<{
    key: string;
    title: string;
    trigger: string | null;
    content: string;
    order: number;
    isActive: boolean;
  }>;
  seasonRates: Array<{
    name: string;
    startDate: string;
    endDate: string;
    percentageBonus: number;
    fixedBonus: number;
    isHoliday: boolean;
    isActive: boolean;
  }>;
  coupons: Array<{
    code: string;
    discountType: string;
    discountValue: number;
    minOrder: number;
    maxUses: number | null;
    isActive: boolean;
    expiresAt: string | null;
  }>;
  datilProfileNonSecret: {
    ruc: string;
    razonSocial: string;
    nombreComercial: string | null;
    direccionMatriz: string;
    direccionEstablecimiento: string | null;
    regimen: string;
    obligadoContabilidad: boolean;
    contribuyenteEspecial: string | null;
    establecimiento: string;
    puntoEmision: string;
    secuencialFactura: number;
  } | null;
}

export interface BackupInspectionResult {
  isValid: boolean;
  manifest: BackupManifest;
  dataPreview: {
    name: string;
    slug: string;
    businessType: string;
    plan: string;
    categoriesCount: number;
    dishesCount: number;
    modifierGroupsCount: number;
    campaignsCount: number;
    couponsCount: number;
    whatsappTemplatesCount: number;
  };
  targetStatus: {
    targetId: string | null;
    exists: boolean;
    name?: string;
    slug?: string;
    existingDishesCount?: number;
    existingCategoriesCount?: number;
    isSameSourceBusiness?: boolean;
    isDuplicatePackageRetry?: boolean;
  };
  conflicts: {
    slugTakenByOther: boolean;
    slugConflictMessage?: string;
    categoryNamesConflict: string[];
    dishNamesConflict: string[];
    dishSkusConflict: string[];
  };
  photosSummary: {
    totalInZip: number;
    validImages: number;
    invalidImages: string[];
  };
  reconnectionNotes: string[];
  warnings: string[];
}

export interface RestoreBackupOptions {
  targetRestaurantId?: string;
  mode: "UPDATE_EXISTING" | "CREATE_NEW";
  newSlug?: string;
  newOwnerEmail?: string;
  confirmMergeConflicts?: boolean; // Confirmación explícita para combinar platos/categorías con nombres coincidentes
}

export interface RestoreBackupResult {
  success: boolean;
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  createdNew: boolean;
  isRetry: boolean;
  batchesApplied: string[];
  restoredCounts: {
    categoriesCreated: number;
    categoriesUpdated: number;
    dishesCreated: number;
    dishesUpdated: number;
    modifierGroupsProcessed: number;
    photosWritten: number;
    photosReused: number;
    campaignsProcessed: number;
    couponsProcessed: number;
    whatsappTemplatesProcessed: number;
  };
  reconnectionNotes: string[];
  warnings: string[];
}

export interface BackupDbClients {
  tenant: any;
  control: any;
}

// ============================================================================
// MOTOR ZIP EN TYPESCRIPT PURO (CERO DEPENDENCIAS EXTERNAS)
// ============================================================================

export interface ZipEntry {
  name: string;
  content: Buffer;
}

/**
 * Genera un Buffer ZIP estándar (PKZIP 2.0) a partir de una lista de entradas de archivo.
 */
export function createZipBuffer(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const cleanName = entry.name.replace(/\\/g, "/").replace(/^\/+/, "");
    const nameBuf = Buffer.from(cleanName, "utf8");
    const content = entry.content;
    const uncompressedSize = content.length;
    const crc = computeCrc32(content);

    const compressed = zlib.deflateRawSync(content);
    const useDeflate = compressed.length < uncompressedSize;
    const payload = useDeflate ? compressed : content;
    const method = useDeflate ? 8 : 0;
    const compressedSize = payload.length;

    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(compressedSize, 18);
    lh.writeUInt32LE(uncompressedSize, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    nameBuf.copy(lh, 30);

    localHeaders.push(lh, payload);

    const ch = Buffer.alloc(46 + nameBuf.length);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(compressedSize, 20);
    ch.writeUInt32LE(uncompressedSize, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(currentOffset, 42);
    nameBuf.copy(ch, 46);

    centralHeaders.push(ch);
    currentOffset += lh.length + payload.length;
  }

  const centralDirOffset = currentOffset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) centralDirSize += ch.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/**
 * Descomprime y extrae entradas de un Buffer ZIP con estrictas defensas:
 * - maxOutputLength limitado al menor presupuesto permitido durante inflateRawSync
 * - Rechazo de discrepancias entre tamaño real y declarado
 * - Verificación CRC32
 * - Rechazo explícito de ZIP64, cifrado y symlinks
 * - Rechazo de path traversal (Zip Slip)
 */
export function parseZipBuffer(buf: Buffer): ZipEntry[] {
  if (!buf || buf.length < 22) {
    throw new Error("El archivo proporcionado no es un archivo ZIP válido (tamaño insuficiente).");
  }

  if (buf.length > MAX_ZIP_FILE_SIZE) {
    throw new Error(
      `El archivo ZIP excede el tamaño máximo permitido de ${MAX_ZIP_FILE_SIZE / (1024 * 1024)} MB.`
    );
  }

  // 1. Localizar firma EOCD (0x06054b50) escaneando los últimos 65KB
  let eocdOffset = -1;
  const minOffset = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Firma de fin de directorio central ZIP (EOCD) no encontrada.");
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdSize = buf.readUInt32LE(eocdOffset + 12);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  // RECHAZO EXPLÍCITO DE ZIP64
  if (totalEntries === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    throw new Error(
      "Formato ZIP64 detectado y no soportado. Los respaldos de negocio no deben exceder 100 MB."
    );
  }

  if (totalEntries > MAX_ZIP_ENTRIES) {
    throw new Error(
      `El archivo ZIP contiene ${totalEntries} entradas, superando el límite de seguridad de ${MAX_ZIP_ENTRIES}.`
    );
  }

  if (cdOffset + cdSize > buf.length) {
    throw new Error("Estructura de directorio central ZIP corrupta o manipulada.");
  }

  const entries: ZipEntry[] = [];
  let curr = cdOffset;
  let accumulatedUncompressedBytes = 0;

  for (let i = 0; i < totalEntries; i++) {
    if (curr + 46 > buf.length) {
      throw new Error("Encabezado de directorio central truncado.");
    }
    if (buf.readUInt32LE(curr) !== 0x02014b50) {
      throw new Error(`Firma inválida de entrada de directorio central en el índice ${i}.`);
    }

    const flags = buf.readUInt16LE(curr + 8);
    const method = buf.readUInt16LE(curr + 10);
    const expectedCrc = buf.readUInt32LE(curr + 16);
    const compressedSize = buf.readUInt32LE(curr + 20);
    const uncompressedSize = buf.readUInt32LE(curr + 24);
    const nameLen = buf.readUInt16LE(curr + 28);
    const extraLen = buf.readUInt16LE(curr + 30);
    const commentLen = buf.readUInt16LE(curr + 32);
    const externalAttrs = buf.readUInt32LE(curr + 38);
    const localOffset = buf.readUInt32LE(curr + 42);

    // RECHAZO EXPLÍCITO DE ARCHIVOS CIFRADOS (Bit 0 o Bit 6)
    if ((flags & 0x0001) !== 0 || (flags & 0x0040) !== 0) {
      throw new Error("Archivos ZIP cifrados o protegidos con contraseña no están permitidos por seguridad.");
    }

    // RECHAZO EXPLÍCITO DE SYMLINKS (Enlaces simbólicos Unix: 0o120000)
    const unixMode = (externalAttrs >>> 16) & 0xffff;
    if ((unixMode & 0o170000) === 0o120000) {
      throw new Error("Entrada ZIP rechazada: los enlaces simbólicos (symlinks) están estrictamente prohibidos.");
    }

    // RECHAZO DE MÉTODOS NO SOPORTADOS
    if (method !== 0 && method !== 8) {
      throw new Error(`Método de compresión ZIP no soportado (${method}). Solo se admiten Store y Deflate.`);
    }

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error("Entrada con campos ZIP64 detectada y rechazada.");
    }

    const name = buf.toString("utf8", curr + 46, curr + 46 + nameLen);
    curr += 46 + nameLen + extraLen + commentLen;

    validateSafeZipEntryPath(name);

    if (name.endsWith("/")) {
      continue;
    }

    // Presupuesto máximo permitido para esta entrada antes de descomprimir
    const remainingBudget = MAX_TOTAL_UNCOMPRESSED_SIZE - accumulatedUncompressedBytes;
    const isImage = name.startsWith("fotos/");
    const maxBudgetForEntry = Math.min(
      uncompressedSize,
      isImage ? MAX_IMAGE_FILE_SIZE : MAX_TOTAL_UNCOMPRESSED_SIZE,
      remainingBudget
    );

    if (maxBudgetForEntry <= 0 || uncompressedSize > remainingBudget) {
      throw new Error(
        `Alerta de seguridad (Anti-Zip Bomb): presupuesto de descompresión agotado al procesar "${name}".`
      );
    }

    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Encabezado local corrupto o no coincidente para la entrada "${name}".`);
    }

    const localCompressedSize = buf.readUInt32LE(localOffset + 18);
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLen + localExtraLen;

    if (dataOffset + localCompressedSize > buf.length) {
      throw new Error(`Datos truncados para la entrada "${name}".`);
    }

    const rawData = buf.subarray(dataOffset, dataOffset + localCompressedSize);
    let extractedContent: Buffer;

    if (method === 0) {
      if (rawData.length > maxBudgetForEntry) {
        throw new Error(`Entrada almacenada excede el presupuesto permitido en "${name}".`);
      }
      extractedContent = Buffer.from(rawData);
    } else {
      try {
        // LIMITACIÓN ESTRICTA EN DEFLATE: maxOutputLength previene agotamiento de memoria
        extractedContent = zlib.inflateRawSync(rawData, { maxOutputLength: maxBudgetForEntry });
      } catch (err: any) {
        throw new Error(`Fallo al descomprimir la entrada "${name}": ${err?.message || "error zlib"}`);
      }
    }

    // RECHAZO DE DISCREPANCIA ENTRE TAMAÑO REAL Y DECLARADO
    if (extractedContent.length !== uncompressedSize) {
      throw new Error(
        `Discrepancia de seguridad en "${name}": tamaño descomprimido real (${extractedContent.length} bytes) no coincide con el declarado en cabecera (${uncompressedSize} bytes).`
      );
    }

    accumulatedUncompressedBytes += extractedContent.length;
    if (accumulatedUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_SIZE) {
      throw new Error(
        `Alerta de seguridad (Anti-Zip Bomb): los bytes reales descomprimidos superaron ${MAX_TOTAL_UNCOMPRESSED_SIZE / (1024 * 1024)
        } MB.`
      );
    }

    // VERIFICACIÓN CRC32
    const computedCrc = computeCrc32(extractedContent);
    if (computedCrc !== expectedCrc) {
      throw new Error(
        `Fallo de integridad CRC32 en la entrada "${name}" (esperado: ${expectedCrc}, obtenido: ${computedCrc}).`
      );
    }

    entries.push({
      name,
      content: extractedContent,
    });
  }

  return entries;
}

export function validateSafeZipEntryPath(entryPath: string): void {
  if (!entryPath || typeof entryPath !== "string") {
    throw new Error("Nombre de archivo ZIP inválido o vacío.");
  }

  if (entryPath.includes("\0")) {
    throw new Error(`Intento de Zip Slip detectado: carácter nulo en "${entryPath}".`);
  }

  const normalized = entryPath.replace(/\\/g, "/");

  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error(`Intento de Zip Slip detectado: ruta absoluta no permitida "${entryPath}".`);
  }

  const segments = normalized.split("/");
  for (const seg of segments) {
    if (seg === ".." || seg === ".") {
      throw new Error(`Intento de Zip Slip detectado: segmento relativo no permitido "${seg}" en "${entryPath}".`);
    }
  }
}

// ============================================================================
// SERVICIO DE EXPORTACIÓN A ZIP POR NEGOCIO
// ============================================================================

export async function generateBusinessBackupZip(
  restaurantId: string,
  clients?: BackupDbClients
): Promise<{
  zipBuffer: Buffer;
  manifest: BackupManifest;
  filename: string;
}> {
  const db = clients || { tenant: prismaTenant, control: prismaControl };

  const restaurant = await db.tenant.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      categories: { orderBy: { order: "asc" } },
      dishes: {
        orderBy: { createdAt: "asc" },
        include: {
          supplier: { select: { name: true } },
          modifierGroups: {
            include: { options: { orderBy: { createdAt: "asc" } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      campaigns: { orderBy: { order: "asc" }, include: { dishes: true } },
      ruletaConfig: true,
      whatsAppTemplates: { orderBy: { order: "asc" } },
      seasonRates: { orderBy: { startDate: "asc" } },
      coupons: { orderBy: { createdAt: "desc" } },
      datilConfig: true,
      whatsappInstance: { select: { id: true, instanceName: true, status: true } },
    },
  });

  if (!restaurant) {
    throw new Error(`No se encontró ningún negocio con ID "${restaurantId}".`);
  }

  const reconnectionItems: string[] = [];
  if (restaurant.datilConfig && restaurant.datilConfig.isEnabled) {
    reconnectionItems.push(
      "Facturación Electrónica SRI (Dátil): Clave de API (X-Key) y contraseña cifrada (X-Password) han sido excluidas por seguridad. Deberán reingresarse en /admin/restaurante."
    );
  }
  if (restaurant.whatsappInstance) {
    reconnectionItems.push(
      `Bot de WhatsApp (Instancia: ${restaurant.whatsappInstance.instanceName}): La sesión activa debe re-vincularse (escaneo de QR) en el nuevo servidor.`
    );
  }
  if (restaurant.aiProvider && restaurant.aiProvider !== "NONE") {
    reconnectionItems.push(
      `Asistente IA (${restaurant.aiProvider}): Clave de API privada excluida. Configure la API Key en el nuevo servidor.`
    );
  }
  reconnectionItems.push(
    "Credenciales de Propietario: Las contraseñas y cuentas de usuario no se exportan. Al restaurar se vinculará al SuperAdmin o usuario que se designe."
  );

  // Recopilar fotos locales y externas
  const referencedPhotos = new Set<string>();
  const addPhotoRef = (url: string | null | undefined) => {
    if (!url || typeof url !== "string") return;
    const trimmed = url.trim();
    if (!trimmed) return;

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const parsed = parseDishImages(trimmed);
      for (const p of parsed) addPhotoRef(p);
      return;
    }
    referencedPhotos.add(trimmed);
  };

  addPhotoRef(restaurant.logoUrl);
  addPhotoRef(restaurant.coverUrl);
  addPhotoRef(restaurant.qrCobroUrl);
  addPhotoRef(restaurant.payphoneQrUrl);
  addPhotoRef(restaurant.seoImage);

  for (const dish of restaurant.dishes) {
    addPhotoRef(dish.imageUrl);
  }
  for (const camp of restaurant.campaigns) {
    addPhotoRef(camp.imageUrl);
  }

  const includedPhotos: { zipPath: string; buffer: Buffer; sha256: string; originalRef: string }[] = [];
  const missingPhotos: string[] = [];
  const externalPhotos: string[] = [];

  for (const photoUrl of Array.from(referencedPhotos)) {
    const localRelPath = resolveLocalStorageRelativePath(photoUrl);

    if (!localRelPath) {
      // URL externa no coincidente con los orígenes locales confirmados: no se descarga (Anti-SSRF)
      externalPhotos.push(photoUrl);
      continue;
    }

    const safeDiskPath = await validateAndResolveSafeDiskPath(localRelPath);

    if (safeDiskPath) {
      try {
        const fileBuffer = await fs.readFile(safeDiskPath);
        const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
        const cleanBase = path.basename(safeDiskPath);
        includedPhotos.push({
          zipPath: `fotos/${cleanBase}`,
          buffer: fileBuffer,
          sha256: hash,
          originalRef: photoUrl,
        });
      } catch {
        missingPhotos.push(photoUrl);
      }
    } else {
      missingPhotos.push(photoUrl);
    }
  }

  let modifierGroupsCount = 0;
  let modifierOptionsCount = 0;
  for (const d of restaurant.dishes) {
    modifierGroupsCount += d.modifierGroups.length;
    for (const g of d.modifierGroups) {
      modifierOptionsCount += g.options.length;
    }
  }

  const warnings: string[] = [];
  if (missingPhotos.length > 0) {
    warnings.push(
      `${missingPhotos.length} imagen(es) referenciada(s) en la base de datos no se encontraron físicamente en el almacenamiento local.`
    );
  }
  if (externalPhotos.length > 0) {
    warnings.push(
      `${externalPhotos.length} imagen(es) apuntan a URLs externas o de dominios no locales y no fueron empaquetadas.`
    );
  }

  const exportTimestamp = new Date().toISOString();
  const packageId = crypto
    .createHash("sha256")
    .update(`${restaurant.id}:${restaurant.slug}:${exportTimestamp}`)
    .digest("hex")
    .slice(0, 32);

  // REGLA: Si hay fotos faltantes o fotos externas no empaquetadas, isComplete = false
  const isComplete = missingPhotos.length === 0 && externalPhotos.length === 0;

  const manifest: BackupManifest = {
    version: "1.0.0",
    schemaVersion: 1,
    packageId,
    exportedAt: exportTimestamp,
    sourceRestaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      businessType: restaurant.businessType,
      catalogMode: restaurant.catalogMode,
      plan: restaurant.plan,
      themeColor: restaurant.themeColor,
    },
    counts: {
      categories: restaurant.categories.length,
      dishes: restaurant.dishes.length,
      modifierGroups: modifierGroupsCount,
      modifierOptions: modifierOptionsCount,
      campaigns: restaurant.campaigns.length,
      whatsappTemplates: restaurant.whatsAppTemplates?.length || 0,
      seasonRates: restaurant.seasonRates.length,
      coupons: restaurant.coupons.length,
      hasRuletaConfig: Boolean(restaurant.ruletaConfig),
      hasDatilProfile: Boolean(restaurant.datilConfig),
    },
    photos: {
      totalReferenced: referencedPhotos.size,
      included: includedPhotos.length,
      missing: missingPhotos,
      external: externalPhotos,
    },
    reconnectionItems,
    isComplete,
    warnings,
  };

  const businessData: BusinessDataBackup = {
    manifest,
    identity: {
      name: restaurant.name,
      slug: restaurant.slug,
      businessType: restaurant.businessType,
      catalogMode: restaurant.catalogMode,
      themeColor: restaurant.themeColor,
      slogan: restaurant.slogan,
      description: restaurant.description,
      specialty: restaurant.specialty,
      services: restaurant.services,
      tablesConfig: restaurant.tablesConfig,
      customLabels: restaurant.customLabels,
      plan: restaurant.plan,
      priceRange: restaurant.priceRange,
      testMode: restaurant.testMode,
    },
    location: {
      country: restaurant.country,
      province: restaurant.province,
      city: restaurant.city,
      parish: restaurant.parish,
      sector: restaurant.sector,
      neighborhood: restaurant.neighborhood,
      postalCode: restaurant.postalCode,
      address: restaurant.address,
      locality: restaurant.locality,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      mapEmbedUrl: restaurant.mapEmbedUrl,
    },
    schedules: {
      schedule: restaurant.schedule,
      localSchedule: restaurant.localSchedule,
      deliverySchedule: restaurant.deliverySchedule,
      blockedDates: restaurant.blockedDates,
      structuredSchedule: restaurant.structuredSchedule,
    },
    orderingAndDelivery: {
      enableTableOrdering: restaurant.enableTableOrdering,
      enableDelivery: restaurant.enableDelivery,
      enablePickup: restaurant.enablePickup,
      ivaPercent: restaurant.ivaPercent,
      servicePercent: restaurant.servicePercent,
      deliveryCost: restaurant.deliveryCost,
      deliveryEnabled: restaurant.deliveryEnabled,
      deliveryRates: restaurant.deliveryRates,
      ivaOnTable: restaurant.ivaOnTable,
      ivaOnTakeout: restaurant.ivaOnTakeout,
      serviceOnTable: restaurant.serviceOnTable,
      serviceOnTakeout: restaurant.serviceOnTakeout,
    },
    contactAndSocial: {
      whatsapp: restaurant.whatsapp,
      contactNumbers: restaurant.contactNumbers,
      instagram: restaurant.instagram,
      facebook: restaurant.facebook,
      tiktok: restaurant.tiktok,
      ubicameUrl: restaurant.ubicameUrl,
      reservationUrl: restaurant.reservationUrl,
      googleBusinessUrl: restaurant.googleBusinessUrl,
    },
    seo: {
      seoTitle: restaurant.seoTitle,
      seoDescription: restaurant.seoDescription,
      seoKeywords: restaurant.seoKeywords,
      customFaq: restaurant.customFaq,
    },
    bankingNonSecret: {
      bankName: restaurant.bankName,
      bankAccountType: restaurant.bankAccountType,
      bankAccountNumber: restaurant.bankAccountNumber,
      bankAccountName: restaurant.bankAccountName,
      bankAccountDocument: restaurant.bankAccountDocument,
      bankAccountEmail: restaurant.bankAccountEmail,
      deunaPhone: restaurant.deunaPhone,
      payphonePhone: restaurant.payphonePhone,
      payphoneUrl: restaurant.payphoneUrl,
    },
    brandingPhotos: {
      logoUrl: restaurant.logoUrl,
      coverUrl: restaurant.coverUrl,
      qrCobroUrl: restaurant.qrCobroUrl,
      payphoneQrUrl: restaurant.payphoneQrUrl,
      seoImage: restaurant.seoImage,
    },
    categories: restaurant.categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      order: c.order,
      imageAspectRatio: c.imageAspectRatio,
    })),
    dishes: restaurant.dishes.map((d: any) => ({
      id: d.id,
      categoryId: d.categoryId,
      name: d.name,
      description: d.description,
      price: d.price,
      imageUrl: d.imageUrl,
      isAvailable: d.isAvailable,
      sku: d.sku,
      barcode: d.barcode,
      costPrice: d.costPrice,
      stock: d.stock,
      minStock: d.minStock,
      trackStock: d.trackStock,
      isService: d.isService,
      vatRate: d.vatRate,
      hasIce: d.hasIce,
      variants: d.variants,
      isSuggested: d.isSuggested,
      supplierName: d.supplier?.name || null,
      modifierGroups: d.modifierGroups.map((g: any) => ({
        id: g.id,
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        options: g.options.map((o: any) => ({
          id: o.id,
          name: o.name,
          extraPrice: Number(o.extraPrice),
        })),
      })),
    })),
    campaigns: restaurant.campaigns.map((camp: any) => ({
      id: camp.id,
      title: camp.title,
      type: camp.type,
      badgeText: camp.badgeText,
      description: camp.description,
      imageUrl: camp.imageUrl,
      startDate: camp.startDate ? camp.startDate.toISOString() : null,
      endDate: camp.endDate ? camp.endDate.toISOString() : null,
      eventDate: camp.eventDate ? camp.eventDate.toISOString() : null,
      startTime: camp.startTime,
      endTime: camp.endTime,
      daysOfWeek: camp.daysOfWeek,
      discountType: camp.discountType,
      discountValue: camp.discountValue,
      ctaType: camp.ctaType,
      ctaText: camp.ctaText,
      whatsappMessage: camp.whatsappMessage,
      externalUrl: camp.externalUrl,
      isActive: camp.isActive,
      showInProfile: camp.showInProfile,
      showInCatalog: camp.showInCatalog,
      order: camp.order,
      dishIds: camp.dishes.map((cd: any) => cd.dishId),
    })),
    ruletaConfig: restaurant.ruletaConfig
      ? {
        activa: restaurant.ruletaConfig.activa,
        titulo: restaurant.ruletaConfig.titulo,
        descripcion: restaurant.ruletaConfig.descripcion,
        colorPrimario: restaurant.ruletaConfig.colorPrimario,
        colorSecundario: restaurant.ruletaConfig.colorSecundario,
        colorFondo: restaurant.ruletaConfig.colorFondo,
        premios: restaurant.ruletaConfig.premios,
        limiteDiasReGiro: restaurant.ruletaConfig.limiteDiasReGiro,
        maxGirosIpDia: restaurant.ruletaConfig.maxGirosIpDia,
        expiracionHoras: restaurant.ruletaConfig.expiracionHoras,
      }
      : null,
    whatsappTemplates: (restaurant.whatsAppTemplates || []).map((t: any) => ({
      key: t.key,
      title: t.title,
      trigger: t.trigger,
      content: t.content,
      order: t.order,
      isActive: t.isActive,
    })),
    seasonRates: restaurant.seasonRates.map((sr: any) => ({
      name: sr.name,
      startDate: sr.startDate.toISOString(),
      endDate: sr.endDate.toISOString(),
      percentageBonus: sr.percentageBonus,
      fixedBonus: sr.fixedBonus,
      isHoliday: sr.isHoliday,
      isActive: sr.isActive,
    })),
    coupons: restaurant.coupons.map((cp: any) => ({
      code: cp.code,
      discountType: cp.discountType,
      discountValue: cp.discountValue,
      minOrder: cp.minOrder,
      maxUses: cp.maxUses,
      isActive: cp.isActive,
      expiresAt: cp.expiresAt ? cp.expiresAt.toISOString() : null,
    })),
    datilProfileNonSecret: restaurant.datilConfig
      ? {
        ruc: restaurant.datilConfig.ruc,
        razonSocial: restaurant.datilConfig.razonSocial,
        nombreComercial: restaurant.datilConfig.nombreComercial,
        direccionMatriz: restaurant.datilConfig.direccionMatriz,
        direccionEstablecimiento: restaurant.datilConfig.direccionEstablecimiento,
        regimen: restaurant.datilConfig.regimen,
        obligadoContabilidad: restaurant.datilConfig.obligadoContabilidad,
        contribuyenteEspecial: restaurant.datilConfig.contribuyenteEspecial,
        establecimiento: restaurant.datilConfig.establecimiento,
        puntoEmision: restaurant.datilConfig.puntoEmision,
        secuencialFactura: restaurant.datilConfig.secuencialFactura,
      }
      : null,
  };

  // HOJA EXCEL CON LAS 13 COLUMNAS EXACTAS EXIGIDAS
  const categoryNameMap = new Map<string, string>();
  for (const c of restaurant.categories) {
    categoryNameMap.set(c.id, c.name);
  }

  const excelMenuData = restaurant.dishes.map((d: any) => {
    const cost = d.costPrice ?? 0;
    const price = d.price ?? 0;
    const margin = price > 0 ? Number((price - cost).toFixed(2)) : 0;
    const skuOrBarcode = d.sku || d.barcode || "";

    return {
      Categoria: categoryNameMap.get(d.categoryId) || "General",
      Nombre: d.name,
      Descripcion: d.description || "",
      Precio: price,
      Costo_Compra: cost,
      Margen_Estimado: margin,
      Proveedor_Habitual: d.supplier?.name || "",
      Codigo_Barras_SKU: skuOrBarcode,
      Disponible: d.isAvailable ? "SI" : "NO",
      Controla_Stock: d.trackStock ? "SI" : "NO",
      Stock_Disponible: d.stock ?? "",
      Stock_Minimo: d.minStock ?? 0,
      URL_Imagen: d.imageUrl || "",
    };
  });

  const excelModifiersData: any[] = [];
  for (const d of restaurant.dishes) {
    for (const g of d.modifierGroups) {
      for (const o of g.options) {
        excelModifiersData.push({
          PlatoProducto: d.name,
          GrupoModificador: g.name,
          MinimoSeleccion: g.minSelect,
          MaximoSeleccion: g.maxSelect,
          OpcionExtra: o.name,
          PrecioExtra: Number(o.extraPrice),
        });
      }
    }
  }

  const excelCampaignsData = restaurant.campaigns.map((c: any) => ({
    Titulo: c.title,
    Tipo: c.type,
    Etiqueta: c.badgeText || "",
    Descuento: c.discountValue ?? 0,
    TipoDescuento: c.discountType,
    Activo: c.isActive ? "SI" : "NO",
  }));

  const excelInfoData = [
    { Campo: "Nombre del Negocio", Valor: restaurant.name },
    { Campo: "Slug / Enlace", Valor: restaurant.slug },
    { Campo: "Tipo de Negocio", Valor: restaurant.businessType },
    { Campo: "Modo Catálogo", Valor: restaurant.catalogMode },
    { Campo: "Plan Licencia", Valor: restaurant.plan },
    { Campo: "WhatsApp", Valor: restaurant.whatsapp },
    { Campo: "Provincia", Valor: restaurant.province || "" },
    { Campo: "Ciudad", Valor: restaurant.city || "" },
    { Campo: "Dirección", Valor: restaurant.address || "" },
    { Campo: "Fecha de Exportación", Valor: manifest.exportedAt },
  ];

  const wb = XLSX.utils.book_new();
  const wsMenu = XLSX.utils.json_to_sheet(excelMenuData);
  const wsInfo = XLSX.utils.json_to_sheet(excelInfoData);
  XLSX.utils.book_append_sheet(wb, wsMenu, "Menu_Catalogo");
  if (excelModifiersData.length > 0) {
    const wsMod = XLSX.utils.json_to_sheet(excelModifiersData);
    XLSX.utils.book_append_sheet(wb, wsMod, "Modificadores");
  }
  if (excelCampaignsData.length > 0) {
    const wsCamp = XLSX.utils.json_to_sheet(excelCampaignsData);
    XLSX.utils.book_append_sheet(wb, wsCamp, "Campanas");
  }
  XLSX.utils.book_append_sheet(wb, wsInfo, "Info_Negocio");

  const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const zipEntries: ZipEntry[] = [
    {
      name: "manifest.json",
      content: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    },
    {
      name: "datos.json",
      content: Buffer.from(JSON.stringify(businessData, null, 2), "utf8"),
    },
    {
      name: "catalogo.xlsx",
      content: Buffer.isBuffer(excelBuffer) ? excelBuffer : Buffer.from(excelBuffer),
    },
  ];

  for (const photo of includedPhotos) {
    zipEntries.push({
      name: photo.zipPath,
      content: photo.buffer,
    });
  }

  const zipBuffer = createZipBuffer(zipEntries);
  const cleanDate = new Date().toISOString().slice(0, 10);
  const filename = `respaldo-${restaurant.slug}-${cleanDate}.zip`;

  return {
    zipBuffer,
    manifest,
    filename,
  };
}

// ============================================================================
// SERVICIO DE INSPECCIÓN PREVIA (DRY-RUN PREVIEW ANTES DE RESTAURAR)
// ============================================================================

export async function inspectBackupZip(
  zipBuffer: Buffer,
  targetRestaurantId?: string | null,
  clients?: BackupDbClients
): Promise<BackupInspectionResult> {
  const db = clients || { tenant: prismaTenant, control: prismaControl };
  const entries = parseZipBuffer(zipBuffer);

  const manifestEntry = entries.find((e) => e.name === "manifest.json");
  const datosEntry = entries.find((e) => e.name === "datos.json");

  if (!manifestEntry || !datosEntry) {
    throw new Error(
      "El archivo ZIP es inválido: no contiene los archivos esenciales 'manifest.json' o 'datos.json'."
    );
  }

  let manifest: BackupManifest;
  let businessData: BusinessDataBackup;

  try {
    manifest = JSON.parse(manifestEntry.content.toString("utf8"));
    businessData = JSON.parse(datosEntry.content.toString("utf8"));
  } catch (err: any) {
    throw new Error(`Error de sintaxis al leer el JSON del respaldo: ${err?.message || "JSON corrupto"}`);
  }

  if (manifest.version !== "1.0.0" || !businessData.identity || !businessData.categories) {
    throw new Error("El formato o versión del respaldo no es compatible con esta versión del sistema.");
  }

  const photoEntries = entries.filter((e) => e.name.startsWith("fotos/") && e.name.length > 6);
  let validImagesCount = 0;
  const invalidImages: string[] = [];

  for (const pe of photoEntries) {
    const ext = pe.name.split(".").pop()?.toLowerCase() || "";
    if (validateImageMagicBytes(pe.content, ext)) {
      validImagesCount++;
    } else {
      invalidImages.push(pe.name);
    }
  }

  const effectiveSlug = businessData.identity.slug;
  let targetRestaurant: any = null;

  if (targetRestaurantId) {
    targetRestaurant = await db.tenant.restaurant.findUnique({
      where: { id: targetRestaurantId },
      include: { categories: true, dishes: true },
    });
  } else {
    targetRestaurant = await db.tenant.restaurant.findUnique({
      where: { slug: effectiveSlug },
      include: { categories: true, dishes: true },
    });
  }

  const categoryNamesConflict: string[] = [];
  const dishNamesConflict: string[] = [];
  const dishSkusConflict: string[] = [];
  let slugTakenByOther = false;
  let slugConflictMessage: string | undefined = undefined;
  let isSameSourceBusiness = false;
  let isDuplicatePackageRetry = false;

  if (targetRestaurant) {
    if (targetRestaurant.customLabels) {
      try {
        const labelsObj = JSON.parse(targetRestaurant.customLabels);
        if (labelsObj.backupSync) {
          if (labelsObj.backupSync.sourceRestaurantId === manifest.sourceRestaurant.id) {
            isSameSourceBusiness = true;
          }
          if (labelsObj.backupSync.lastPackageId === manifest.packageId) {
            isDuplicatePackageRetry = true;
          }
        }
      } catch { }
    }

    if (!targetRestaurantId) {
      slugTakenByOther = true;
      slugConflictMessage = `El slug original "${effectiveSlug}" ya está registrado por el negocio "${targetRestaurant.name}". Para reintentar o continuar sobre este negocio existente selecciónalo como destino en modo UPDATE_EXISTING; para crear una copia independiente ingresa un slug libre.`;
    } else if (targetRestaurant.slug !== effectiveSlug) {
      const slugOwner = await db.tenant.restaurant.findUnique({
        where: { slug: effectiveSlug },
        select: { id: true, name: true },
      });
      if (slugOwner && slugOwner.id !== targetRestaurant.id) {
        slugTakenByOther = true;
        slugConflictMessage = `El slug original "${effectiveSlug}" ya está asignado a otro negocio ("${slugOwner.name}").`;
      }
    }

    const existingCatNames = new Set((targetRestaurant.categories || []).map((c: any) => c.name.toLowerCase().trim()));
    for (const c of businessData.categories) {
      if (existingCatNames.has(c.name.toLowerCase().trim())) {
        categoryNamesConflict.push(c.name);
      }
    }

    const existingDishNames = new Set((targetRestaurant.dishes || []).map((d: any) => d.name.toLowerCase().trim()));
    const existingSkus = new Set(
      (targetRestaurant.dishes || []).map((d: any) => (d.sku || "").toLowerCase().trim()).filter(Boolean)
    );

    for (const d of businessData.dishes) {
      if (existingDishNames.has(d.name.toLowerCase().trim())) {
        dishNamesConflict.push(d.name);
      }
      if (d.sku && existingSkus.has(d.sku.toLowerCase().trim())) {
        dishSkusConflict.push(d.sku);
      }
    }
  } else {
    const slugOwner = await db.tenant.restaurant.findUnique({
      where: { slug: effectiveSlug },
      select: { id: true, name: true },
    });
    if (slugOwner) {
      slugTakenByOther = true;
      slugConflictMessage = `El slug "${effectiveSlug}" ya está registrado en este servidor ("${slugOwner.name}"). Para crear un nuevo negocio debe ingresar un slug disponible.`;
    }
  }

  let modifierGroupsTotal = 0;
  for (const d of businessData.dishes) {
    modifierGroupsTotal += d.modifierGroups ? d.modifierGroups.length : 0;
  }

  return {
    isValid: true,
    manifest,
    dataPreview: {
      name: businessData.identity.name,
      slug: businessData.identity.slug,
      businessType: businessData.identity.businessType,
      plan: businessData.identity.plan,
      categoriesCount: businessData.categories.length,
      dishesCount: businessData.dishes.length,
      modifierGroupsCount: modifierGroupsTotal,
      campaignsCount: businessData.campaigns ? businessData.campaigns.length : 0,
      couponsCount: businessData.coupons ? businessData.coupons.length : 0,
      whatsappTemplatesCount: businessData.whatsappTemplates ? businessData.whatsappTemplates.length : 0,
    },
    targetStatus: {
      targetId: targetRestaurant ? targetRestaurant.id : null,
      exists: Boolean(targetRestaurant),
      name: targetRestaurant?.name,
      slug: targetRestaurant?.slug,
      existingDishesCount: targetRestaurant?.dishes?.length ?? 0,
      existingCategoriesCount: targetRestaurant?.categories?.length ?? 0,
      isSameSourceBusiness,
      isDuplicatePackageRetry,
    },
    conflicts: {
      slugTakenByOther,
      slugConflictMessage,
      categoryNamesConflict,
      dishNamesConflict,
      dishSkusConflict,
    },
    photosSummary: {
      totalInZip: photoEntries.length,
      validImages: validImagesCount,
      invalidImages,
    },
    reconnectionNotes: manifest.reconnectionItems || [],
    warnings: manifest.warnings || [],
  };
}

// ============================================================================
// SERVICIO DE RESTAURACIÓN CON COMBINACIÓN SIN BORRADOS (IDEMPOTENTE Y SEGURO)
// ============================================================================

export function sanitizeErrorMessage(rawMessage: string): string {
  if (!rawMessage) return "Error no especificado durante la persistencia en base de datos.";

  // Ocultar URLs de bases de datos y credenciales
  let sanitized = rawMessage
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+(@[^\s]+)/gi, "$1***$2")
    .replace(/(password|passwd|secret|token|apikey|authorization)=['"]?[^;&\s"']+['"]?/gi, "$1=***");

  // Si contiene errores típicos de Prisma/SQL conocidos, retornar mensaje amigable sin detalles de servidor
  if (sanitized.includes("Unique constraint failed") || sanitized.includes("P2002")) {
    const fieldMatch = sanitized.match(/fields:\s*\(`?([^`\)]+)`?\)/i);
    return `Restricción de duplicidad en base de datos (campo: ${fieldMatch ? fieldMatch[1] : "valor único duplicado"}).`;
  }
  if (sanitized.includes("Foreign key constraint failed") || sanitized.includes("P2003")) {
    return "Restricción de clave foránea en base de datos: elemento relacionado no encontrado.";
  }
  if (sanitized.includes("Can't reach database server") || sanitized.includes("P1001")) {
    return "No se pudo establecer conexión con el servidor de base de datos.";
  }
  if (sanitized.includes("Database error") || sanitized.includes("PrismaClientKnownRequestError")) {
    return "Error de persistencia en la base de datos.";
  }

  // Si es un mensaje excesivamente largo con stack trace, truncarlo con seguridad
  if (sanitized.length > 250) {
    sanitized = sanitized.substring(0, 250) + "...";
  }

  return sanitized;
}

export async function restoreBusinessBackupZip(
  zipBuffer: Buffer,
  options: RestoreBackupOptions,
  clients?: BackupDbClients
): Promise<RestoreBackupResult> {
  const db = clients || { tenant: prismaTenant, control: prismaControl };
  const entries = parseZipBuffer(zipBuffer);

  const manifestEntry = entries.find((e) => e.name === "manifest.json");
  const datosEntry = entries.find((e) => e.name === "datos.json");

  if (!manifestEntry || !datosEntry) {
    throw new Error("Respaldo corrupto: faltan manifest.json o datos.json.");
  }

  const manifest: BackupManifest = JSON.parse(manifestEntry.content.toString("utf8"));
  const data: BusinessDataBackup = JSON.parse(datosEntry.content.toString("utf8"));

  // 1. RESTRICCIÓN DE SLUG: Eliminación absoluta de slugs aleatorios y conversión automática
  let targetSlug = (options.newSlug || data.identity.slug).toLowerCase().trim();
  let targetRestaurantId = options.mode === "CREATE_NEW" ? undefined : options.targetRestaurantId;

  if (options.mode === "CREATE_NEW" || !targetRestaurantId) {
    const existingSlugOwner = await db.tenant.restaurant.findUnique({
      where: { slug: targetSlug },
      select: { id: true, name: true },
    });

    if (existingSlugOwner) {
      throw new Error(
        `Conflicto de slug: El slug "${targetSlug}" ya está registrado en este servidor por "${existingSlugOwner.name}". Para continuar o reintentar sobre este negocio existente debe seleccionarlo explícitamente en modo UPDATE_EXISTING; para crear una copia independiente ingrese un slug diferente disponible.`
      );
    }
  }

  if (options.mode === "UPDATE_EXISTING" && !targetRestaurantId) {
    throw new Error("Debe seleccionar un negocio destino para actualizar en modo UPDATE_EXISTING.");
  }

  // 2. Extracción y guardado de fotos con hash SHA256 y seguimiento de rollback
  let currentStage: string = "EXTRACCION_FOTOS";
  let dbWriteAttempted = false;
  const uploadRootDir = path.resolve(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadRootDir, { recursive: true });

  const photoUrlMap = new Map<string, string>();
  const newlyCreatedFiles: string[] = [];
  let photosWrittenCount = 0;
  let photosReusedCount = 0;

  const photoEntries = entries.filter((e) => e.name.startsWith("fotos/") && e.name.length > 6);
  for (const pe of photoEntries) {
    const rawFilename = pe.name.replace(/^fotos\//, "").trim();
    const cleanFilename = path.basename(rawFilename).replace(/[^a-zA-Z0-9._-]/g, "_");

    if (!cleanFilename || cleanFilename.includes("..")) continue;

    const ext = cleanFilename.split(".").pop()?.toLowerCase() || "";
    if (!validateImageMagicBytes(pe.content, ext)) {
      console.warn(`[Restore Backup] Foto "${pe.name}" rechazada por magic bytes inválidos.`);
      continue;
    }

    const targetFilePath = path.join(uploadRootDir, cleanFilename);
    let finalFilename = cleanFilename;

    try {
      const existingStat = await fs.stat(targetFilePath).catch(() => null);
      if (existingStat && existingStat.isFile()) {
        const existingBuf = await fs.readFile(targetFilePath);
        const existingHash = crypto.createHash("sha256").update(existingBuf).digest("hex");
        const newHash = crypto.createHash("sha256").update(pe.content).digest("hex");

        if (existingHash === newHash) {
          photosReusedCount++;
        } else {
          const safePrefix = `restore-${crypto.randomBytes(4).toString("hex")}`;
          finalFilename = `${safePrefix}-${cleanFilename}`;
          const newTargetFilePath = path.join(uploadRootDir, finalFilename);
          await fs.writeFile(newTargetFilePath, pe.content);
          newlyCreatedFiles.push(newTargetFilePath);
          photosWrittenCount++;
        }
      } else {
        await fs.writeFile(targetFilePath, pe.content);
        newlyCreatedFiles.push(targetFilePath);
        photosWrittenCount++;
      }

      const originalRelUrl = `/uploads/${rawFilename}`;
      const newRelUrl = `/uploads/${finalFilename}`;
      photoUrlMap.set(originalRelUrl, newRelUrl);
      photoUrlMap.set(`uploads/${rawFilename}`, newRelUrl);

      // Mapear también si vino como URL absoluta propia
      photoUrlMap.set(`https://menuqr.ubicame.cc/uploads/${rawFilename}`, newRelUrl);
      photoUrlMap.set(`https://ubicame.cc/uploads/${rawFilename}`, newRelUrl);
    } catch (writeErr: any) {
      for (const f of newlyCreatedFiles) {
        await fs.unlink(f).catch(() => { });
      }
      throw new Error(`Error escribiendo imagen en disco: ${writeErr?.message || "error I/O"}`);
    }
  }

  const remapPhotoUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const parts = parseDishImages(trimmed);
      const remapped = parts.map((p) => photoUrlMap.get(p) || p);
      return serializeDishImages(remapped);
    }

    return photoUrlMap.get(trimmed) || trimmed;
  };

  // Función de limpieza de archivos temporales (SÓLO se ejecuta si falla previo a intentar escrituras en BD)
  const cleanupStagedPhotos = async () => {
    for (const f of newlyCreatedFiles) {
      await fs.unlink(f).catch(() => { });
    }
  };

  // 3. Ejecución por lotes con seguimiento de progreso e idempotencia estricta
  const batchesApplied: string[] = [];

  let backupSyncMeta: {
    lastPackageId?: string;
    sourceRestaurantId?: string;
    categoryMap: Record<string, string>;
    dishMap: Record<string, string>;
    modifierGroupMap: Record<string, string>;
    optionMap: Record<string, string>;
  } = {
    sourceRestaurantId: manifest.sourceRestaurant.id,
    lastPackageId: manifest.packageId,
    categoryMap: {},
    dishMap: {},
    modifierGroupMap: {},
    optionMap: {},
  };

  const persistProgressCheckpoint = async () => {
    if (!targetRestaurantId) return;
    try {
      const currentRest = await db.tenant.restaurant.findUnique({
        where: { id: targetRestaurantId },
        select: { customLabels: true },
      });
      let labelsObj: any = {};
      if (currentRest?.customLabels) {
        try {
          labelsObj = JSON.parse(currentRest.customLabels);
        } catch {
          labelsObj = {};
        }
      }
      labelsObj.backupSync = {
        ...backupSyncMeta,
        lastPackageId: manifest.packageId,
        sourceRestaurantId: manifest.sourceRestaurant.id,
      };
      await db.tenant.restaurant.update({
        where: { id: targetRestaurantId },
        data: { customLabels: JSON.stringify(labelsObj) },
      });
    } catch (chkErr) {
      console.warn("[RESTORE CHECKPOINT WARNING] No se pudo persistir el checkpoint de progreso:", chkErr);
    }
  };

  try {
    let createdNew = false;
    let isRetry = false;
    let assignedUserId = "";

    let targetRestExisting: any = null;

    if (!targetRestaurantId) {
      currentStage = "CREACION_NEGOCIO";
      if (options.newOwnerEmail && db.control?.user?.findUnique) {
        const existingUser = await db.control.user.findUnique({
          where: { email: options.newOwnerEmail.toLowerCase().trim() },
          select: { id: true },
        });
        if (existingUser) assignedUserId = existingUser.id;
      }

      if (!assignedUserId && db.control?.user?.findFirst) {
        const defaultUser = await db.control.user.findFirst({
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (defaultUser) assignedUserId = defaultUser.id;
      }

      if (!assignedUserId) {
        assignedUserId = "default-admin-id";
      }

      let initialLabelsObj: any = {};
      if (data.identity.customLabels) {
        try {
          initialLabelsObj = JSON.parse(data.identity.customLabels);
        } catch {
          initialLabelsObj = {};
        }
      }
      initialLabelsObj.backupSync = { ...backupSyncMeta };

      // Registro de primer intento de persistencia en BD
      dbWriteAttempted = true;

      const newRest = await db.tenant.restaurant.create({
        data: {
          userId: assignedUserId,
          name: data.identity.name,
          slug: targetSlug,
          whatsapp: data.contactAndSocial?.whatsapp || null,
          themeColor: data.identity.themeColor || "#ef4444",
          businessType: (data.identity.businessType as any) || "RESTAURANT",
          catalogMode: (data.identity.catalogMode as any) || "MENU",
          plan: (data.identity.plan as any) || "FREE",
          slogan: data.identity.slogan,
          description: data.identity.description,
          specialty: data.identity.specialty,
          services: data.identity.services,
          tablesConfig: data.identity.tablesConfig || "1,2,3,4,5,6,7,8,9,10",
          customLabels: JSON.stringify(initialLabelsObj),
          priceRange: data.identity.priceRange || "$$",
          testMode: data.identity.testMode ?? false,

          country: data.location?.country || "Ecuador",
          province: data.location?.province,
          city: data.location?.city,
          parish: data.location?.parish,
          sector: data.location?.sector,
          neighborhood: data.location?.neighborhood,
          postalCode: data.location?.postalCode,
          address: data.location?.address,
          locality: data.location?.locality,
          latitude: data.location?.latitude,
          longitude: data.location?.longitude,
          mapEmbedUrl: data.location?.mapEmbedUrl,

          schedule: data.schedules?.schedule,
          localSchedule: data.schedules?.localSchedule,
          deliverySchedule: data.schedules?.deliverySchedule,
          blockedDates: data.schedules?.blockedDates,
          structuredSchedule: data.schedules?.structuredSchedule,

          enableTableOrdering: data.orderingAndDelivery?.enableTableOrdering,
          enableDelivery: data.orderingAndDelivery?.enableDelivery,
          enablePickup: data.orderingAndDelivery?.enablePickup,
          ivaPercent: data.orderingAndDelivery?.ivaPercent,
          servicePercent: data.orderingAndDelivery?.servicePercent,
          deliveryCost: data.orderingAndDelivery?.deliveryCost,
          deliveryEnabled: data.orderingAndDelivery?.deliveryEnabled,
          deliveryRates: data.orderingAndDelivery?.deliveryRates,
          ivaOnTable: data.orderingAndDelivery?.ivaOnTable,
          ivaOnTakeout: data.orderingAndDelivery?.ivaOnTakeout,
          serviceOnTable: data.orderingAndDelivery?.serviceOnTable,
          serviceOnTakeout: data.orderingAndDelivery?.serviceOnTakeout,

          contactNumbers: data.contactAndSocial?.contactNumbers,
          instagram: data.contactAndSocial?.instagram,
          facebook: data.contactAndSocial?.facebook,
          tiktok: data.contactAndSocial?.tiktok,
          ubicameUrl: data.contactAndSocial?.ubicameUrl,
          reservationUrl: data.contactAndSocial?.reservationUrl,
          googleBusinessUrl: data.contactAndSocial?.googleBusinessUrl,

          seoTitle: data.seo?.seoTitle,
          seoDescription: data.seo?.seoDescription,
          seoKeywords: data.seo?.seoKeywords,
          customFaq: data.seo?.customFaq,

          bankName: data.bankingNonSecret?.bankName,
          bankAccountType: data.bankingNonSecret?.bankAccountType,
          bankAccountNumber: data.bankingNonSecret?.bankAccountNumber,
          bankAccountName: data.bankingNonSecret?.bankAccountName,
          bankAccountDocument: data.bankingNonSecret?.bankAccountDocument,
          bankAccountEmail: data.bankingNonSecret?.bankAccountEmail,
          deunaPhone: data.bankingNonSecret?.deunaPhone,
          payphonePhone: data.bankingNonSecret?.payphonePhone,
          payphoneUrl: data.bankingNonSecret?.payphoneUrl,

          logoUrl: remapPhotoUrl(data.brandingPhotos?.logoUrl),
          coverUrl: remapPhotoUrl(data.brandingPhotos?.coverUrl),
          qrCobroUrl: remapPhotoUrl(data.brandingPhotos?.qrCobroUrl),
          payphoneQrUrl: remapPhotoUrl(data.brandingPhotos?.payphoneQrUrl),
          seoImage: remapPhotoUrl(data.brandingPhotos?.seoImage),
        },
      });

      targetRestaurantId = newRest.id;
      createdNew = true;
      batchesApplied.push("CREACION_NEGOCIO");
    } else {
      currentStage = "ACTUALIZACION_IDENTIDAD_NEGOCIO";
      // Actualizar datos del negocio destino existente
      targetRestExisting = await db.tenant.restaurant.findUnique({
        where: { id: targetRestaurantId },
      });

      if (!targetRestExisting) {
        throw new Error(`El negocio destino con ID "${targetRestaurantId}" no existe.`);
      }

      if (targetRestExisting.customLabels) {
        try {
          const parsed = JSON.parse(targetRestExisting.customLabels);
          if (parsed.backupSync) {
            backupSyncMeta = { ...backupSyncMeta, ...parsed.backupSync };
            if (
              parsed.backupSync.lastPackageId === manifest.packageId &&
              parsed.backupSync.sourceRestaurantId === manifest.sourceRestaurant.id
            ) {
              isRetry = true;
            }
          }
        } catch { }
      }

      // Registro de primer intento de persistencia en BD
      dbWriteAttempted = true;

      await db.tenant.restaurant.update({
        where: { id: targetRestaurantId },
        data: {
          name: data.identity.name,
          themeColor: data.identity.themeColor || "#ef4444",
          businessType: (data.identity.businessType as any) || "RESTAURANT",
          catalogMode: (data.identity.catalogMode as any) || "MENU",
          slogan: data.identity.slogan,
          description: data.identity.description,
          specialty: data.identity.specialty,
          services: data.identity.services,
          tablesConfig: data.identity.tablesConfig || "1,2,3,4,5,6,7,8,9,10",
          priceRange: data.identity.priceRange || "$$",

          country: data.location?.country || "Ecuador",
          province: data.location?.province,
          city: data.location?.city,
          parish: data.location?.parish,
          sector: data.location?.sector,
          neighborhood: data.location?.neighborhood,
          postalCode: data.location?.postalCode,
          address: data.location?.address,
          locality: data.location?.locality,
          latitude: data.location?.latitude,
          longitude: data.location?.longitude,
          mapEmbedUrl: data.location?.mapEmbedUrl,

          schedule: data.schedules?.schedule,
          localSchedule: data.schedules?.localSchedule,
          deliverySchedule: data.schedules?.deliverySchedule,
          blockedDates: data.schedules?.blockedDates,
          structuredSchedule: data.schedules?.structuredSchedule,

          enableTableOrdering: data.orderingAndDelivery?.enableTableOrdering,
          enableDelivery: data.orderingAndDelivery?.enableDelivery,
          enablePickup: data.orderingAndDelivery?.enablePickup,
          ivaPercent: data.orderingAndDelivery?.ivaPercent,
          servicePercent: data.orderingAndDelivery?.servicePercent,
          deliveryCost: data.orderingAndDelivery?.deliveryCost,
          deliveryEnabled: data.orderingAndDelivery?.deliveryEnabled,
          deliveryRates: data.orderingAndDelivery?.deliveryRates,
          ivaOnTable: data.orderingAndDelivery?.ivaOnTable,
          ivaOnTakeout: data.orderingAndDelivery?.ivaOnTakeout,
          serviceOnTable: data.orderingAndDelivery?.serviceOnTable,
          serviceOnTakeout: data.orderingAndDelivery?.serviceOnTakeout,

          contactNumbers: data.contactAndSocial?.contactNumbers,
          instagram: data.contactAndSocial?.instagram,
          facebook: data.contactAndSocial?.facebook,
          tiktok: data.contactAndSocial?.tiktok,
          ubicameUrl: data.contactAndSocial?.ubicameUrl,
          reservationUrl: data.contactAndSocial?.reservationUrl,
          googleBusinessUrl: data.contactAndSocial?.googleBusinessUrl,

          seoTitle: data.seo?.seoTitle,
          seoDescription: data.seo?.seoDescription,
          seoKeywords: data.seo?.seoKeywords,
          customFaq: data.seo?.customFaq,

          bankName: data.bankingNonSecret?.bankName,
          bankAccountType: data.bankingNonSecret?.bankAccountType,
          bankAccountNumber: data.bankingNonSecret?.bankAccountNumber,
          bankAccountName: data.bankingNonSecret?.bankAccountName,
          bankAccountDocument: data.bankingNonSecret?.bankAccountDocument,
          bankAccountEmail: data.bankingNonSecret?.bankAccountEmail,
          deunaPhone: data.bankingNonSecret?.deunaPhone,
          payphonePhone: data.bankingNonSecret?.payphonePhone,
          payphoneUrl: data.bankingNonSecret?.payphoneUrl,

          logoUrl: remapPhotoUrl(data.brandingPhotos?.logoUrl),
          coverUrl: remapPhotoUrl(data.brandingPhotos?.coverUrl),
          qrCobroUrl: remapPhotoUrl(data.brandingPhotos?.qrCobroUrl),
          payphoneQrUrl: remapPhotoUrl(data.brandingPhotos?.payphoneQrUrl),
          seoImage: remapPhotoUrl(data.brandingPhotos?.seoImage),
        },
      });
      batchesApplied.push("ACTUALIZACION_IDENTIDAD_NEGOCIO");
    }

    // 4. LOTE DE CATEGORÍAS (Idempotente y validado contra el destino)
    currentStage = "LOTE_CATEGORIAS";
    const categoryIdMap = new Map<string, string>();
    let categoriesCreatedCount = 0;
    let categoriesUpdatedCount = 0;

    for (const srcCat of data.categories) {
      let matchedTargetCatId: string | null = null;

      // Validar mapa previo contra el destino estricto
      if (backupSyncMeta.categoryMap[srcCat.id]) {
        const prevTarget = await db.tenant.category.findFirst({
          where: { id: backupSyncMeta.categoryMap[srcCat.id], restaurantId: targetRestaurantId },
          select: { id: true },
        });
        if (prevTarget) matchedTargetCatId = prevTarget.id;
      }

      if (!matchedTargetCatId) {
        const nameMatch = await db.tenant.category.findFirst({
          where: {
            restaurantId: targetRestaurantId,
            name: { equals: srcCat.name, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (nameMatch) matchedTargetCatId = nameMatch.id;
      }

      if (matchedTargetCatId) {
        await db.tenant.category.update({
          where: { id: matchedTargetCatId },
          data: { order: srcCat.order, imageAspectRatio: srcCat.imageAspectRatio },
        });
        categoriesUpdatedCount++;
      } else {
        const created = await db.tenant.category.create({
          data: {
            restaurantId: targetRestaurantId,
            name: srcCat.name,
            order: srcCat.order,
            imageAspectRatio: srcCat.imageAspectRatio,
          },
          select: { id: true },
        });
        matchedTargetCatId = created.id;
        categoriesCreatedCount++;
      }

      categoryIdMap.set(srcCat.id, matchedTargetCatId);
      backupSyncMeta.categoryMap[srcCat.id] = matchedTargetCatId;
    }
    batchesApplied.push("LOTE_CATEGORIAS");

    // 5. LOTE DE PLATOS / PRODUCTOS (Idempotente, con Variantes de Talla/Color y Modificadores)
    currentStage = "LOTE_PLATOS_Y_MODIFICADORES";
    const dishIdMap = new Map<string, string>();
    let dishesCreatedCount = 0;
    let dishesUpdatedCount = 0;
    let modifierGroupsProcessedCount = 0;

    for (const srcDish of data.dishes) {
      const targetCategoryId = categoryIdMap.get(srcDish.categoryId);
      if (!targetCategoryId) continue;

      let matchedTargetDishId: string | null = null;

      // 1° Validar mapa previo contra el destino
      if (backupSyncMeta.dishMap[srcDish.id]) {
        const prevTarget = await db.tenant.dish.findFirst({
          where: { id: backupSyncMeta.dishMap[srcDish.id], restaurantId: targetRestaurantId },
          select: { id: true },
        });
        if (prevTarget) matchedTargetDishId = prevTarget.id;
      }

      // 2° Validar por SKU en el destino
      if (!matchedTargetDishId && srcDish.sku) {
        const skuMatch = await db.tenant.dish.findFirst({
          where: { restaurantId: targetRestaurantId, sku: srcDish.sku },
          select: { id: true },
        });
        if (skuMatch) matchedTargetDishId = skuMatch.id;
      }

      // 3° Validar por Código de Barras
      if (!matchedTargetDishId && srcDish.barcode) {
        const barcodeMatch = await db.tenant.dish.findFirst({
          where: { restaurantId: targetRestaurantId, barcode: srcDish.barcode },
          select: { id: true },
        });
        if (barcodeMatch) matchedTargetDishId = barcodeMatch.id;
      }

      // 4° Validar por Nombre + Categoría en el destino
      if (!matchedTargetDishId) {
        const nameCatMatch = await db.tenant.dish.findFirst({
          where: {
            restaurantId: targetRestaurantId,
            categoryId: targetCategoryId,
            name: { equals: srcDish.name, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (nameCatMatch) {
          // Requiere confirmación si hay coincidencia por nombre y no se envió confirmación explícita
          if (options.confirmMergeConflicts !== false) {
            matchedTargetDishId = nameCatMatch.id;
          }
        }
      }

      const remappedImageUrl = remapPhotoUrl(srcDish.imageUrl);

      if (matchedTargetDishId) {
        await db.tenant.dish.update({
          where: { id: matchedTargetDishId },
          data: {
            categoryId: targetCategoryId,
            name: srcDish.name,
            description: srcDish.description,
            price: srcDish.price,
            imageUrl: remappedImageUrl,
            isAvailable: srcDish.isAvailable,
            sku: srcDish.sku,
            barcode: srcDish.barcode,
            costPrice: srcDish.costPrice,
            stock: srcDish.stock,
            minStock: srcDish.minStock,
            trackStock: srcDish.trackStock,
            isService: srcDish.isService,
            vatRate: (srcDish.vatRate as any) || "STANDARD",
            hasIce: srcDish.hasIce,
            variants: srcDish.variants, // Conserva variantes JSON de talla y color
            isSuggested: srcDish.isSuggested,
          },
        });
        dishesUpdatedCount++;
      } else {
        const created = await db.tenant.dish.create({
          data: {
            restaurantId: targetRestaurantId,
            categoryId: targetCategoryId,
            name: srcDish.name,
            description: srcDish.description,
            price: srcDish.price,
            imageUrl: remappedImageUrl,
            isAvailable: srcDish.isAvailable,
            sku: srcDish.sku,
            barcode: srcDish.barcode,
            costPrice: srcDish.costPrice,
            stock: srcDish.stock,
            minStock: srcDish.minStock,
            trackStock: srcDish.trackStock,
            isService: srcDish.isService,
            vatRate: (srcDish.vatRate as any) || "STANDARD",
            hasIce: srcDish.hasIce,
            variants: srcDish.variants,
            isSuggested: srcDish.isSuggested,
          },
          select: { id: true },
        });
        matchedTargetDishId = created.id;
        dishesCreatedCount++;
      }

      dishIdMap.set(srcDish.id, matchedTargetDishId);
      backupSyncMeta.dishMap[srcDish.id] = matchedTargetDishId;

      // MODIFICADORES Y EXTRAS IDEMPOTENTES
      if (srcDish.modifierGroups && srcDish.modifierGroups.length > 0) {
        for (const srcGroup of srcDish.modifierGroups) {
          let matchedGroupId: string | null = null;
          if (backupSyncMeta.modifierGroupMap[srcGroup.id]) {
            const prevGroup = await db.tenant.dishModifierGroup.findFirst({
              where: { id: backupSyncMeta.modifierGroupMap[srcGroup.id], dishId: matchedTargetDishId },
              select: { id: true },
            });
            if (prevGroup) matchedGroupId = prevGroup.id;
          }

          if (!matchedGroupId) {
            const nameGroupMatch = await db.tenant.dishModifierGroup.findFirst({
              where: {
                dishId: matchedTargetDishId,
                name: { equals: srcGroup.name, mode: "insensitive" },
              },
              select: { id: true },
            });
            if (nameGroupMatch) matchedGroupId = nameGroupMatch.id;
          }

          if (matchedGroupId) {
            await db.tenant.dishModifierGroup.update({
              where: { id: matchedGroupId },
              data: { minSelect: srcGroup.minSelect, maxSelect: srcGroup.maxSelect },
            });
          } else {
            const createdGroup = await db.tenant.dishModifierGroup.create({
              data: {
                dishId: matchedTargetDishId,
                name: srcGroup.name,
                minSelect: srcGroup.minSelect,
                maxSelect: srcGroup.maxSelect,
              },
              select: { id: true },
            });
            matchedGroupId = createdGroup.id;
          }

          backupSyncMeta.modifierGroupMap[srcGroup.id] = matchedGroupId;
          modifierGroupsProcessedCount++;

          for (const srcOpt of srcGroup.options) {
            let matchedOptId: string | null = null;
            if (backupSyncMeta.optionMap[srcOpt.id]) {
              const prevOpt = await db.tenant.dishModifierOption.findFirst({
                where: { id: backupSyncMeta.optionMap[srcOpt.id], groupId: matchedGroupId },
                select: { id: true },
              });
              if (prevOpt) matchedOptId = prevOpt.id;
            }

            if (!matchedOptId) {
              const nameOptMatch = await db.tenant.dishModifierOption.findFirst({
                where: {
                  groupId: matchedGroupId,
                  name: { equals: srcOpt.name, mode: "insensitive" },
                },
                select: { id: true },
              });
              if (nameOptMatch) matchedOptId = nameOptMatch.id;
            }

            if (matchedOptId) {
              await db.tenant.dishModifierOption.update({
                where: { id: matchedOptId },
                data: { extraPrice: srcOpt.extraPrice },
              });
            } else {
              const createdOpt = await db.tenant.dishModifierOption.create({
                data: {
                  groupId: matchedGroupId,
                  name: srcOpt.name,
                  extraPrice: srcOpt.extraPrice,
                },
                select: { id: true },
              });
              matchedOptId = createdOpt.id;
            }

            backupSyncMeta.optionMap[srcOpt.id] = matchedOptId;
          }
        }
      }
    }
    batchesApplied.push("LOTE_PLATOS_Y_MODIFICADORES");

    // 6. LOTE DE CAMPAÑAS COMERCIALES
    currentStage = "LOTE_CAMPANAS";
    let campaignsProcessedCount = 0;
    if (data.campaigns && data.campaigns.length > 0) {
      for (const srcCamp of data.campaigns) {
        const remappedDishes = (srcCamp.dishIds || [])
          .map((srcDishId) => dishIdMap.get(srcDishId))
          .filter((id): id is string => Boolean(id));

        const existingCamp = await db.tenant.businessCampaign.findFirst({
          where: { restaurantId: targetRestaurantId, title: { equals: srcCamp.title, mode: "insensitive" } },
          select: { id: true },
        });

        if (existingCamp) {
          await db.tenant.businessCampaign.update({
            where: { id: existingCamp.id },
            data: {
              type: (srcCamp.type as any) || "PROMO",
              badgeText: srcCamp.badgeText,
              description: srcCamp.description,
              imageUrl: remapPhotoUrl(srcCamp.imageUrl),
              startDate: srcCamp.startDate ? new Date(srcCamp.startDate) : null,
              endDate: srcCamp.endDate ? new Date(srcCamp.endDate) : null,
              eventDate: srcCamp.eventDate ? new Date(srcCamp.eventDate) : null,
              startTime: srcCamp.startTime,
              endTime: srcCamp.endTime,
              daysOfWeek: srcCamp.daysOfWeek,
              discountType: (srcCamp.discountType as any) || "PERCENTAGE",
              discountValue: srcCamp.discountValue,
              ctaType: srcCamp.ctaType || "WHATSAPP",
              ctaText: srcCamp.ctaText,
              whatsappMessage: srcCamp.whatsappMessage,
              externalUrl: srcCamp.externalUrl,
              isActive: srcCamp.isActive,
              showInProfile: srcCamp.showInProfile,
              showInCatalog: srcCamp.showInCatalog,
              order: srcCamp.order,
            },
          });
        } else {
          await db.tenant.businessCampaign.create({
            data: {
              restaurantId: targetRestaurantId,
              title: srcCamp.title,
              type: (srcCamp.type as any) || "PROMO",
              badgeText: srcCamp.badgeText,
              description: srcCamp.description,
              imageUrl: remapPhotoUrl(srcCamp.imageUrl),
              startDate: srcCamp.startDate ? new Date(srcCamp.startDate) : null,
              endDate: srcCamp.endDate ? new Date(srcCamp.endDate) : null,
              eventDate: srcCamp.eventDate ? new Date(srcCamp.eventDate) : null,
              startTime: srcCamp.startTime,
              endTime: srcCamp.endTime,
              daysOfWeek: srcCamp.daysOfWeek,
              discountType: (srcCamp.discountType as any) || "PERCENTAGE",
              discountValue: srcCamp.discountValue,
              ctaType: srcCamp.ctaType || "WHATSAPP",
              ctaText: srcCamp.ctaText,
              whatsappMessage: srcCamp.whatsappMessage,
              externalUrl: srcCamp.externalUrl,
              isActive: srcCamp.isActive,
              showInProfile: srcCamp.showInProfile,
              showInCatalog: srcCamp.showInCatalog,
              order: srcCamp.order,
              dishes: {
                create: remappedDishes.map((dishId) => ({ dishId })),
              },
            },
          });
        }
        campaignsProcessedCount++;
      }
    }
    batchesApplied.push("LOTE_CAMPANAS");

    // 7. LOTE DE RULETA, PLANTILLAS Y CUPONES
    currentStage = "LOTE_RULETA_PLANTILLAS_CUPONES_DATIL";
    if (data.ruletaConfig) {
      await db.tenant.ruletaConfig.upsert({
        where: { restaurantId: targetRestaurantId },
        update: {
          activa: data.ruletaConfig.activa,
          titulo: data.ruletaConfig.titulo,
          descripcion: data.ruletaConfig.descripcion,
          colorPrimario: data.ruletaConfig.colorPrimario,
          colorSecundario: data.ruletaConfig.colorSecundario,
          colorFondo: data.ruletaConfig.colorFondo,
          premios: data.ruletaConfig.premios,
          limiteDiasReGiro: data.ruletaConfig.limiteDiasReGiro,
          maxGirosIpDia: data.ruletaConfig.maxGirosIpDia,
          expiracionHoras: data.ruletaConfig.expiracionHoras,
        },
        create: {
          restaurantId: targetRestaurantId,
          activa: data.ruletaConfig.activa,
          titulo: data.ruletaConfig.titulo,
          descripcion: data.ruletaConfig.descripcion,
          colorPrimario: data.ruletaConfig.colorPrimario,
          colorSecundario: data.ruletaConfig.colorSecundario,
          colorFondo: data.ruletaConfig.colorFondo,
          premios: data.ruletaConfig.premios,
          limiteDiasReGiro: data.ruletaConfig.limiteDiasReGiro,
          maxGirosIpDia: data.ruletaConfig.maxGirosIpDia,
          expiracionHoras: data.ruletaConfig.expiracionHoras,
        },
      });
    }

    let templatesProcessedCount = 0;
    if (data.whatsappTemplates && data.whatsappTemplates.length > 0) {
      for (const t of data.whatsappTemplates) {
        const existing = await db.tenant.whatsAppTemplate.findFirst({
          where: { restaurantId: targetRestaurantId, key: t.key },
        });
        if (existing) {
          await db.tenant.whatsAppTemplate.update({
            where: { id: existing.id },
            data: { title: t.title, trigger: t.trigger, content: t.content, order: t.order, isActive: t.isActive },
          });
        } else {
          await db.tenant.whatsAppTemplate.create({
            data: {
              restaurantId: targetRestaurantId,
              key: t.key,
              title: t.title,
              trigger: t.trigger,
              content: t.content,
              order: t.order,
              isActive: t.isActive,
            },
          });
        }
        templatesProcessedCount++;
      }
    }

    let couponsProcessedCount = 0;
    if (data.coupons && data.coupons.length > 0) {
      for (const cp of data.coupons) {
        const existing = await db.tenant.coupon.findFirst({
          where: { restaurantId: targetRestaurantId, code: cp.code },
        });
        if (existing) {
          await db.tenant.coupon.update({
            where: { id: existing.id },
            data: {
              discountType: cp.discountType,
              discountValue: cp.discountValue,
              minOrder: cp.minOrder,
              maxUses: cp.maxUses,
              isActive: cp.isActive,
              expiresAt: cp.expiresAt ? new Date(cp.expiresAt) : null,
            },
          });
        } else {
          await db.tenant.coupon.create({
            data: {
              restaurantId: targetRestaurantId,
              code: cp.code,
              discountType: cp.discountType,
              discountValue: cp.discountValue,
              minOrder: cp.minOrder,
              maxUses: cp.maxUses,
              isActive: cp.isActive,
              expiresAt: cp.expiresAt ? new Date(cp.expiresAt) : null,
            },
          });
        }
        couponsProcessedCount++;
      }
    }

    if (data.datilProfileNonSecret) {
      const existingDatil = await db.tenant.datilConfig.findUnique({
        where: { restaurantId: targetRestaurantId },
      });
      if (existingDatil) {
        await db.tenant.datilConfig.update({
          where: { restaurantId: targetRestaurantId },
          data: {
            ruc: data.datilProfileNonSecret.ruc,
            razonSocial: data.datilProfileNonSecret.razonSocial,
            nombreComercial: data.datilProfileNonSecret.nombreComercial,
            direccionMatriz: data.datilProfileNonSecret.direccionMatriz,
            direccionEstablecimiento: data.datilProfileNonSecret.direccionEstablecimiento,
            regimen: data.datilProfileNonSecret.regimen,
            obligadoContabilidad: data.datilProfileNonSecret.obligadoContabilidad,
            contribuyenteEspecial: data.datilProfileNonSecret.contribuyenteEspecial,
            establecimiento: data.datilProfileNonSecret.establecimiento,
            puntoEmision: data.datilProfileNonSecret.puntoEmision,
            secuencialFactura: data.datilProfileNonSecret.secuencialFactura,
          },
        });
      }
    }
    batchesApplied.push("LOTE_RULETA_PLANTILLAS_CUPONES_DATIL");

    // 8. PRESERVACIÓN ESTRICTA DE CUSTOM LABELS: No perder módulos apagados ni etiquetas previas
    currentStage = "LOTE_METADATOS_CUSTOM_LABELS";
    await persistProgressCheckpoint();
    batchesApplied.push("LOTE_METADATOS_CUSTOM_LABELS");

    return {
      success: true,
      restaurantId: targetRestaurantId,
      restaurantSlug: targetSlug,
      restaurantName: data.identity.name,
      createdNew,
      isRetry,
      batchesApplied,
      restoredCounts: {
        categoriesCreated: categoriesCreatedCount,
        categoriesUpdated: categoriesUpdatedCount,
        dishesCreated: dishesCreatedCount,
        dishesUpdated: dishesUpdatedCount,
        modifierGroupsProcessed: modifierGroupsProcessedCount,
        photosWritten: photosWrittenCount,
        photosReused: photosReusedCount,
        campaignsProcessed: campaignsProcessedCount,
        couponsProcessed: couponsProcessedCount,
        whatsappTemplatesProcessed: templatesProcessedCount,
      },
      reconnectionNotes: manifest.reconnectionItems || [],
      warnings: manifest.warnings || [],
    };
  } catch (dbError: any) {
    console.error(
      `[RESTORE CRITICAL ERROR] Falló en etapa "${currentStage}". Lotes aplicados: [${batchesApplied.join(
        ", "
      )}]. dbWriteAttempted: ${dbWriteAttempted}`,
      dbError
    );

    if (dbWriteAttempted) {
      console.warn(
        `[RESTORE PARTIAL FAILURE] Desde que se intentó la primera escritura en BD, las fotos procesadas (${newlyCreatedFiles.length} archivos) se conservan RETENIDAS en disco para recuperación/reintento. NO se ejecuta cleanupStagedPhotos.`
      );
      if (targetRestaurantId) {
        await persistProgressCheckpoint().catch((chkErr) => {
          console.warn("[RESTORE CHECKPOINT WARNING] Error al guardar checkpoint de progreso tras fallo:", chkErr);
        });
      }
    } else {
      // Fallo previo a cualquier escritura en BD: limpieza segura de staged files
      await cleanupStagedPhotos().catch(() => { });
    }

    const confirmedList = batchesApplied.length > 0 ? batchesApplied.join(", ") : "ninguna";
    const sanitizedDetail = sanitizeErrorMessage(dbError?.message || String(dbError));
    const partialNotice = dbWriteAttempted
      ? "Puede haber cambios parciales guardados en la base de datos. Las imágenes procesadas se conservaron en disco para reintento y recuperación."
      : "No se registraron cambios en base de datos. Los archivos temporales fueron descartados de forma segura.";

    const formattedError = new Error(
      `Error en etapa "${currentStage}". Etapas confirmadas: [${confirmedList}]. ${partialNotice} Detalle: ${sanitizedDetail}`
    );
    (formattedError as any).stage = currentStage;
    (formattedError as any).confirmedBatches = [...batchesApplied];
    (formattedError as any).partialChangesPossible = dbWriteAttempted;
    (formattedError as any).photosRetained = dbWriteAttempted ? newlyCreatedFiles.length : 0;
    (formattedError as any).isRestorePartialFailure = true;

    throw formattedError;
  }
}
