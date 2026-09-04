"use server";

import { prismaControl, prismaTenant, prisma } from "@/lib/db";
import { getUserSession, setUserSession, clearUserSession, getSuperAdminSession, setSuperAdminSession, clearSuperAdminSession, refreshUserSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import { recordSlugChange } from "@/lib/slugs";
import { trackAnalyticsEvent } from "@/lib/analytics";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB max

function validateImageMagicBytes(buffer: Buffer, ext: string): boolean {
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

// Helper to save files to public/uploads
async function saveUploadedFile(file: File | null): Promise<string | null> {
  if (!file || file.size === 0 || !file.name) {
    return null;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    console.warn(`[Security Upload] File size ${file.size} bytes exceeds limit of ${MAX_FILE_SIZE_BYTES} bytes.`);
    return null;
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(fileExt)) {
    console.warn(`[Security Upload] Extension .${fileExt} is not allowed.`);
    return null;
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    console.warn(`[Security Upload] MIME type ${file.type} is not in allowed list.`);
    return null;
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!validateImageMagicBytes(buffer, fileExt)) {
      console.warn(`[Security Upload] Magic bytes inspection failed for extension .${fileExt}`);
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
    console.error("Error saving file:", error);
    return null;
  }
}

/**
 * Validates external image HTTP/HTTPS URLs (strictly rejecting JavaScript, local paths, or malformed protocols)
 */
export async function validateExternalImageUrl(
  url: string | null | undefined,
  options?: { allowLegacyUploads?: boolean }
): Promise<{ isValid: boolean; cleanUrl: string | null; error?: string }> {
  if (!url || typeof url !== "string") {
    return { isValid: true, cleanUrl: null };
  }

  const cleanUrl = url.trim();
  if (!cleanUrl) {
    return { isValid: true, cleanUrl: null };
  }

  if (options?.allowLegacyUploads && (cleanUrl.startsWith("/uploads/") || cleanUrl.startsWith("uploads/"))) {
    return { isValid: true, cleanUrl };
  }

  if (cleanUrl.startsWith("/uploads/") || cleanUrl.startsWith("uploads/")) {
    return {
      isValid: false,
      cleanUrl: null,
      error: "Por favor ingresa una URL externa válida (ej. https://.../imagen.webp). No se permiten rutas locales /uploads/ para nuevas imágenes.",
    };
  }

  if (!/^https?:\/\//i.test(cleanUrl)) {
    return { isValid: false, cleanUrl: null, error: "La URL de la imagen debe comenzar con http:// o https://" };
  }

  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { isValid: false, cleanUrl: null, error: "Sólo se permiten protocolos HTTP y HTTPS." };
    }
    return { isValid: true, cleanUrl: parsed.toString() };
  } catch {
    return { isValid: false, cleanUrl: null, error: "El formato de la URL de la imagen es inválido." };
  }
}

/**
 * Multi-tenant Authorization Helper: Verifies that the current user owns the restaurant

 * or is logged in as a SuperAdmin.
 */
async function verifyRestaurantOwnership(restaurantId: string): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const isSuperAdmin = await getSuperAdminSession();
  if (isSuperAdmin) {
    return { authorized: true };
  }

  const session = await getUserSession();
  if (!session || !session.userId) {
    return { authorized: false, error: "No autenticado. Por favor inicie sesión." };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, userId: true },
  });

  if (!restaurant) {
    return { authorized: false, error: "Restaurante no encontrado." };
  }

  if (restaurant.userId !== session.userId) {
    console.warn(`[Security Alert] User ${session.userId} attempted unauthorized action on Restaurant ${restaurantId}`);
    return { authorized: false, error: "No tiene permisos para modificar este restaurante." };
  }

  return { authorized: true, userId: session.userId };
}

// Authentication Actions (SaaS Multi-tenant)
export async function loginUserAction(prevState: unknown, formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      return { error: "Por favor complete todos los campos." };
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check SuperAdmin login via environment variables
    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

    if (superAdminEmail && superAdminPassword && cleanEmail === superAdminEmail && password === superAdminPassword) {
      try {
        await setSuperAdminSession();
        redirect("/super-admin");
      } catch (saError: any) {
        if (saError?.digest?.startsWith("NEXT_REDIRECT") || saError?.message?.includes("NEXT_REDIRECT")) {
          throw saError;
        }
        console.error("Error en Auth (SuperAdmin Session):", saError);
        return { error: "Error al establecer sesión de SuperAdmin." };
      }
    }

    let user: any = null;
    try {
      user = await prismaControl.user.findUnique({
        where: { email: cleanEmail },
      });
    } catch (dbErr) {
      console.error("Error en Auth (Base de datos Prisma):", dbErr);
      return { error: "No se pudo conectar con la base de datos. Por favor intenta nuevamente en unos momentos." };
    }

    if (!user) {
      console.warn(`[Auth Warning] Intento de login con correo no existente: ${cleanEmail}`);
      return { error: "Correo o contraseña incorrectos." };
    }

    let passwordMatch = false;
    try {
      passwordMatch = bcrypt.compareSync(password, user.password);
    } catch (bcryptErr) {
      console.error("Error en Auth (Verificación de contraseña bcrypt):", bcryptErr);
      return { error: "Ocurrió un error al verificar las credenciales." };
    }

    if (!passwordMatch) {
      return { error: "Correo o contraseña incorrectos." };
    }

    try {
      await setUserSession(user.id, user.email);
    } catch (sessionErr) {
      console.error("Error en Auth (Creación de sesión JWT):", sessionErr);
      return { error: "No se pudo iniciar la sesión. Por favor reintenta." };
    }

    redirect("/admin");
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT") || error?.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Error en Auth:", error);
    return { error: "Ocurrió un error inesperado al iniciar sesión. Por favor reintenta." };
  }
}

export async function registerUserAction(prevState: unknown, formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const restaurantName = formData.get("restaurantName") as string;
    const province = formData.get("province") as string;
    const canton = formData.get("canton") as string;
    const parroquia = formData.get("parroquia") as string;
    const acceptTerms = formData.get("acceptTerms");
    const sector = (formData.get("sector") as string) || "";

    if (!name || !email || !password || !restaurantName || !province || !canton || !parroquia) {
      return { error: "Por favor complete todos los campos requeridos de ubicación." };
    }

    if (!acceptTerms || (acceptTerms !== "on" && acceptTerms !== "true")) {
      return { error: "Debe aceptar los Términos y Condiciones y la Política de Privacidad de acuerdo a la legislación ecuatoriana para registrarse." };
    }

    const cleanEmail = email.toLowerCase().trim();

    let existingUser: any = null;
    try {
      existingUser = await prismaControl.user.findUnique({
        where: { email: cleanEmail }
      });
    } catch (dbErr) {
      console.error("Database connection error during register check:", dbErr);
      return { error: "No se pudo conectar a la base de datos. Por favor reintenta en unos segundos." };
    }

    if (existingUser) {
      return { error: "El correo electrónico ya está registrado." };
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    let baseSlug = restaurantName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    if (!baseSlug) {
      baseSlug = "mi-restaurante";
    }

    let cleanSlug = baseSlug;
    let isSlugTaken = true;
    let attempt = 0;

    while (isSlugTaken) {
      let existingRestaurant: any = null;
      try {
        existingRestaurant = await prismaTenant.restaurant.findUnique({
          where: { slug: cleanSlug }
        });
      } catch (dbErr) {
        console.error("Database error checking slug:", dbErr);
        isSlugTaken = false;
        break;
      }
      if (!existingRestaurant) {
        isSlugTaken = false;
      } else {
        attempt++;
        cleanSlug = `${baseSlug}-${attempt}`;
      }
    }

    const trialEndsAt = new Date();
    trialEndsAt.setMonth(trialEndsAt.getMonth() + 1);

    const user = await prismaControl.user.create({
      data: {
        name,
        email: cleanEmail,
        password: hashedPassword,
      },
    });

    const localityParts = [province, canton, parroquia, sector].filter(Boolean);
    const locality = localityParts.length > 0 ? localityParts.join(", ") : null;

    await prismaTenant.restaurant.create({
      data: {
        userId: user.id,
        name: restaurantName,
        slug: cleanSlug,
        whatsapp: "",
        locality,
        trialEndsAt,
      },
    });

    await setUserSession(user.id, user.email);
    redirect("/admin");
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT") || error?.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Error in registerUserAction:", error);
    return { error: "Ocurrió un error inesperado al registrar el usuario. Por favor reintente." };
  }
}

export async function logoutUserAction() {
  const isSuperAdmin = await getSuperAdminSession();
  await clearUserSession();
  if (isSuperAdmin) {
    redirect("/super-admin");
  } else {
    redirect("/");
  }
}

// Restaurant Action
export async function updateRestaurantAction(restaurantId: string, formData: FormData) {
  await refreshUserSession();
  const auth = await verifyRestaurantOwnership(restaurantId);
  if (!auth.authorized) return { error: auth.error };

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const whatsappNumber = formData.get("whatsappNumber") as string;
  const themeColor = formData.get("themeColor") as string;

  const instagram = formData.get("instagram") as string;
  const facebook = formData.get("facebook") as string;
  const tiktok = formData.get("tiktok") as string;
  const address = formData.get("address") as string;
  const slogan = formData.get("slogan") as string;
  const description = formData.get("description") as string;
  const locality = formData.get("locality") as string;
  const schedule = formData.get("schedule") as string;
  const specialty = formData.get("specialty") as string;
  const services = formData.get("services") as string;
  const contactNumbers = formData.get("contactNumbers") as string;
  const ubicameUrl = formData.get("ubicameUrl") as string;
  const mapEmbedUrl = formData.get("mapEmbedUrl") as string;

  const province = formData.get("province") as string;
  const city = formData.get("city") as string;
  const parish = formData.get("parish") as string;
  const sector = formData.get("sector") as string;
  const latInput = formData.get("latitude") as string;
  const lngInput = formData.get("longitude") as string;
  const latitude = latInput !== null && latInput !== "" && !isNaN(parseFloat(latInput)) ? parseFloat(latInput) : null;
  const longitude = lngInput !== null && lngInput !== "" && !isNaN(parseFloat(lngInput)) ? parseFloat(lngInput) : null;

  const seoTitle = formData.get("seoTitle") as string;
  const seoDescription = formData.get("seoDescription") as string;
  const seoKeywords = formData.get("seoKeywords") as string;
  const seoImage = formData.get("seoImage") as string;
  const customFaq = formData.get("customFaq") as string;

  const bankName = formData.get("bankName") as string;
  const bankAccountType = formData.get("bankAccountType") as string;
  const bankAccountNumber = formData.get("bankAccountNumber") as string;
  const bankAccountName = formData.get("bankAccountName") as string;
  const bankAccountDocument = formData.get("bankAccountDocument") as string;
  const bankAccountEmail = formData.get("bankAccountEmail") as string;

  let logoFile = formData.get("logoFile") as File | null;
  if (!logoFile || logoFile.size === 0) {
    logoFile = formData.get("logoFileCamera") as File | null;
  }
  const logoUrlInput = formData.get("logoUrl") as string;
  let logoUrl: string | null = null;

  let coverFile = formData.get("coverFile") as File | null;
  if (!coverFile || coverFile.size === 0) {
    coverFile = formData.get("coverFileCamera") as File | null;
  }
  const coverUrlInput = formData.get("coverUrl") as string;
  let coverUrl: string | null = null;

  const paymentQrFile = formData.get("paymentQrFile") as File | null;
  const paymentQrUrlInput = formData.get("paymentQrUrl") as string;
  let paymentQrUrl: string | null = null;

  const currentRestaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { 
      slug: true, 
      logoUrl: true, 
      coverUrl: true, 
      qrCobroUrl: true, 
      seoImage: true,
      ivaPercent: true,
      servicePercent: true,
      deliveryCost: true,
      deliveryEnabled: true,
      ivaOnTable: true,
      ivaOnTakeout: true,
      serviceOnTable: true,
      serviceOnTakeout: true,
      deliveryRates: true
    },
  });

  const ivaPercentInput = formData.get("ivaPercent") as string;
  const servicePercentInput = formData.get("servicePercent") as string;
  const deliveryCostInput = formData.get("deliveryCost") as string;
  const ivaPercent = ivaPercentInput ? parseFloat(ivaPercentInput) : (currentRestaurant?.ivaPercent ?? 15.0);
  const servicePercent = servicePercentInput ? parseFloat(servicePercentInput) : (currentRestaurant?.servicePercent ?? 10.0);
  const deliveryCost = deliveryCostInput ? parseFloat(deliveryCostInput) : (currentRestaurant?.deliveryCost ?? 0.0);

  const ivaOnTable = formData.has("ivaOnTable") ? formData.get("ivaOnTable") === "true" : (currentRestaurant?.ivaOnTable ?? false);
  const ivaOnTakeout = formData.has("ivaOnTakeout") ? formData.get("ivaOnTakeout") === "true" : (currentRestaurant?.ivaOnTakeout ?? false);
  const serviceOnTable = formData.has("serviceOnTable") ? formData.get("serviceOnTable") === "true" : (currentRestaurant?.serviceOnTable ?? false);
  const serviceOnTakeout = formData.has("serviceOnTakeout") ? formData.get("serviceOnTakeout") === "true" : (currentRestaurant?.serviceOnTakeout ?? false);
  const deliveryEnabled = formData.has("deliveryEnabled") 
    ? (formData.get("deliveryEnabled") === "true" || formData.get("deliveryEnabled") === "on") 
    : (currentRestaurant?.deliveryEnabled ?? false);
  const localSchedule = formData.get("localSchedule") as string;
  const deliverySchedule = formData.get("deliverySchedule") as string;
  const blockedDates = formData.get("blockedDates") as string;
  const deliveryRates = formData.has("deliveryRates") ? (formData.get("deliveryRates") as string) : (currentRestaurant?.deliveryRates || null);

  const uploadedLogo = await saveUploadedFile(logoFile);
  if (uploadedLogo) {
    logoUrl = uploadedLogo;
  } else if (logoUrlInput && logoUrlInput.trim() !== "") {
    const isSameAsCurrent = logoUrlInput.trim() === currentRestaurant?.logoUrl;
    const val = await validateExternalImageUrl(logoUrlInput, { allowLegacyUploads: isSameAsCurrent });
    if (!val.isValid) {
      return { error: val.error || "URL de logo inválida." };
    }
    logoUrl = val.cleanUrl;
  }

  const uploadedCover = await saveUploadedFile(coverFile);
  if (uploadedCover) {
    coverUrl = uploadedCover;
  } else if (coverUrlInput && coverUrlInput.trim() !== "") {
    const isSameAsCurrent = coverUrlInput.trim() === currentRestaurant?.coverUrl;
    const val = await validateExternalImageUrl(coverUrlInput, { allowLegacyUploads: isSameAsCurrent });
    if (!val.isValid) {
      return { error: val.error || "URL de portada inválida." };
    }
    coverUrl = val.cleanUrl;
  }

  const uploadedPaymentQr = await saveUploadedFile(paymentQrFile);
  if (uploadedPaymentQr) {
    paymentQrUrl = uploadedPaymentQr;
  } else if (paymentQrUrlInput && paymentQrUrlInput.trim() !== "") {
    const isSameAsCurrent = paymentQrUrlInput.trim() === currentRestaurant?.qrCobroUrl;
    const val = await validateExternalImageUrl(paymentQrUrlInput, { allowLegacyUploads: isSameAsCurrent });
    if (!val.isValid) {
      return { error: val.error || "URL de QR de pago inválida." };
    }
    paymentQrUrl = val.cleanUrl;
  }

  let cleanSeoImage: string | null = null;
  if (seoImage && seoImage.trim() !== "") {
    const isSameAsCurrent = seoImage.trim() === currentRestaurant?.seoImage;
    const val = await validateExternalImageUrl(seoImage, { allowLegacyUploads: isSameAsCurrent });
    if (!val.isValid) {
      return { error: val.error || "URL de imagen SEO inválida." };
    }
    cleanSeoImage = val.cleanUrl;
  }

  const newSlug = slug.toLowerCase().trim();

  if (currentRestaurant && currentRestaurant.slug !== newSlug) {
    await recordSlugChange(restaurantId, currentRestaurant.slug, newSlug);
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      name,
      slug: newSlug,
      whatsapp: whatsappNumber,
      themeColor,
      logoUrl: logoUrl || null,
      coverUrl: coverUrl || null,
      qrCobroUrl: paymentQrUrl || null,
      instagram: instagram || null,
      facebook: facebook || null,
      tiktok: tiktok || null,
      address: address || null,
      slogan: slogan || null,
      description: description || null,
      locality: locality || null,
      schedule: schedule || null,
      localSchedule: localSchedule || null,
      deliverySchedule: deliverySchedule || null,
      blockedDates: blockedDates || null,
      specialty: specialty || null,
      services: services || null,
      contactNumbers: contactNumbers || null,
      ubicameUrl: ubicameUrl || null,
      mapEmbedUrl: mapEmbedUrl || null,
      province: province || null,
      city: city || null,
      parish: parish || null,
      sector: sector || null,
      latitude,
      longitude,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      seoKeywords: seoKeywords || null,
      seoImage: cleanSeoImage || null,
      customFaq: customFaq || null,
      bankName: bankName || null,
      bankAccountType: bankAccountType || null,
      bankAccountNumber: bankAccountNumber || null,
      bankAccountName: bankAccountName || null,
      bankAccountDocument: bankAccountDocument || null,
      bankAccountEmail: bankAccountEmail || null,
      ivaPercent,
      servicePercent,
      deliveryCost,
      deliveryEnabled,
      deliveryRates: deliveryRates || null,
      ivaOnTable,
      ivaOnTakeout,
      serviceOnTable,
      serviceOnTakeout,
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/${slug}`);
  return { success: true };
}

export async function updateRestaurantSchedulesAction(
  restaurantId: string,
  data: {
    schedule?: string | null;
    localSchedule?: string | null;
    deliverySchedule?: string | null;
    blockedDates?: string | null;
  }
) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        schedule: data.schedule || null,
        localSchedule: data.localSchedule || null,
        deliverySchedule: data.deliverySchedule || null,
        blockedDates: data.blockedDates || null,
      },
    });

    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating restaurant schedules:", error);
    return { error: "No se pudieron actualizar los horarios y fechas de cierre." };
  }
}

export async function updateLogoDirectAction(restaurantId: string, formData: FormData) {
  await refreshUserSession();
  const auth = await verifyRestaurantOwnership(restaurantId);
  if (!auth.authorized) return { error: auth.error };

  const logoFile = formData.get("logoFile") as File | null;
  const logoUrlInput = formData.get("logoUrl") as string;
  let finalLogo: string | null = null;

  const uploadedLogo = await saveUploadedFile(logoFile);
  if (uploadedLogo) {
    finalLogo = uploadedLogo;
  } else if (logoUrlInput && logoUrlInput.trim() !== "") {
    const val = await validateExternalImageUrl(logoUrlInput);
    if (!val.isValid) {
      return { error: val.error || "URL de logo inválida." };
    }
    finalLogo = val.cleanUrl;
  }

  if (!finalLogo) {
    return { error: "No se pudo actualizar el logo. Por favor proporciona una URL válida." };
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { logoUrl: finalLogo },
  });

  revalidatePath("/admin");
  revalidatePath(`/${updated.slug}`);
  return { success: true, logoUrl: finalLogo };
}

export async function updateCoverDirectAction(restaurantId: string, formData: FormData) {
  await refreshUserSession();
  const auth = await verifyRestaurantOwnership(restaurantId);
  if (!auth.authorized) return { error: auth.error };

  const coverFile = formData.get("coverFile") as File | null;
  const coverUrlInput = formData.get("coverUrl") as string;
  let finalCover: string | null = null;

  const uploadedCover = await saveUploadedFile(coverFile);
  if (uploadedCover) {
    finalCover = uploadedCover;
  } else if (coverUrlInput && coverUrlInput.trim() !== "") {
    const val = await validateExternalImageUrl(coverUrlInput);
    if (!val.isValid) {
      return { error: val.error || "URL de portada inválida." };
    }
    finalCover = val.cleanUrl;
  }

  if (!finalCover) {
    return { error: "No se pudo actualizar la portada. Por favor proporciona una URL válida." };
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      coverUrl: finalCover
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/${updated.slug}`);
  return { success: true, coverUrl: finalCover };
}

// Category Actions
export async function createCategoryAction(restaurantId: string, formData: FormData) {
  await refreshUserSession();
  const auth = await verifyRestaurantOwnership(restaurantId);
  if (!auth.authorized) return { error: auth.error };

  const name = formData.get("name") as string;
  const order = parseInt(formData.get("order") as string || "0", 10);

  await prisma.category.create({
    data: {
      name,
      order,
      restaurantId,
    },
  });

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (restaurant) revalidatePath(`/${restaurant.slug}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function updateCategoryAction(categoryId: string, formData: FormData) {
  await refreshUserSession();
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, restaurantId: true },
  });
  if (!category) return { error: "Categoría no encontrada." };

  const auth = await verifyRestaurantOwnership(category.restaurantId);
  if (!auth.authorized) return { error: auth.error };

  const name = formData.get("name") as string;
  const order = parseInt(formData.get("order") as string || "0", 10);

  const updated = await prisma.category.update({
    where: { id: categoryId },
    data: {
      name,
      order,
    },
    include: { restaurant: true },
  });

  revalidatePath(`/${updated.restaurant.slug}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteCategoryAction(categoryId: string) {
  await refreshUserSession();
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, restaurantId: true },
  });
  if (!category) return { error: "Categoría no encontrada." };

  const auth = await verifyRestaurantOwnership(category.restaurantId);
  if (!auth.authorized) return { error: auth.error };

  const deleted = await prisma.category.delete({
    where: { id: categoryId },
    include: { restaurant: true },
  });

  revalidatePath(`/${deleted.restaurant.slug}`);
  revalidatePath("/admin");
  return { success: true };
}

// Dish Actions
export async function createDishAction(categoryId: string, formData: FormData) {
  await refreshUserSession();
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { restaurant: true },
  });

  if (!category) return { error: "Categoría no encontrada." };

  const auth = await verifyRestaurantOwnership(category.restaurantId);
  if (!auth.authorized) return { error: auth.error };

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const price = parseFloat(formData.get("price") as string || "0");
  const isAvailable = formData.get("isAvailable") === "true";

  const dishFile = formData.get("dishFile") as File | null;
  const imageUrlInput = formData.get("imageUrl") as string;
  let finalImageUrl: string | null = null;

  const uploadedImage = await saveUploadedFile(dishFile);
  if (uploadedImage) {
    finalImageUrl = uploadedImage;
  } else if (imageUrlInput && imageUrlInput.trim() !== "") {
    const val = await validateExternalImageUrl(imageUrlInput);
    if (!val.isValid) {
      return { error: val.error || "URL de imagen inválida." };
    }
    finalImageUrl = val.cleanUrl;
  }

  await prisma.dish.create({
    data: {
      name,
      description,
      price,
      imageUrl: finalImageUrl || null,
      isAvailable,
      categoryId,
      restaurantId: category.restaurantId,
    },
  });

  revalidatePath(`/${category.restaurant.slug}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function updateDishAction(dishId: string, formData: FormData) {
  await refreshUserSession();
  const dish = await prisma.dish.findUnique({
    where: { id: dishId },
    select: { id: true, restaurantId: true, imageUrl: true },
  });
  if (!dish) return { error: "Plato no encontrado." };

  const auth = await verifyRestaurantOwnership(dish.restaurantId);
  if (!auth.authorized) return { error: auth.error };

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const price = parseFloat(formData.get("price") as string || "0");
  const isAvailable = formData.get("isAvailable") === "true";

  const dishFile = formData.get("dishFile") as File | null;
  const imageUrlInput = formData.get("imageUrl") as string;
  let finalImageUrl: string | null = null;

  const uploadedImage = await saveUploadedFile(dishFile);
  if (uploadedImage) {
    finalImageUrl = uploadedImage;
  } else if (imageUrlInput && imageUrlInput.trim() !== "") {
    const isSameAsExisting = imageUrlInput.trim() === dish.imageUrl;
    const val = await validateExternalImageUrl(imageUrlInput, { allowLegacyUploads: isSameAsExisting });
    if (!val.isValid) {
      return { error: val.error || "URL de imagen inválida." };
    }
    finalImageUrl = val.cleanUrl;
  }

  const updated = await prisma.dish.update({
    where: { id: dishId },
    data: {
      name,
      description,
      price,
      imageUrl: finalImageUrl || null,
      isAvailable,
    },
    include: {
      category: {
        include: { restaurant: true },
      },
    },
  });

  revalidatePath(`/${updated.category.restaurant.slug}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteDishAction(dishId: string) {
  await refreshUserSession();
  const dish = await prisma.dish.findUnique({
    where: { id: dishId },
    select: { id: true, restaurantId: true },
  });
  if (!dish) return { error: "Plato no encontrado." };

  const auth = await verifyRestaurantOwnership(dish.restaurantId);
  if (!auth.authorized) return { error: auth.error };

  const deleted = await prisma.dish.delete({
    where: { id: dishId },
    include: {
      category: {
        include: { restaurant: true },
      },
    },
  });

  revalidatePath(`/${deleted.category.restaurant.slug}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function toggleDishAvailabilityAction(dishId: string, isAvailable: boolean) {
  try {
    await refreshUserSession();
    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      select: { id: true, restaurantId: true },
    });
    if (!dish) return { error: "El plato no existe o ya fue eliminado." };

    const auth = await verifyRestaurantOwnership(dish.restaurantId);
    if (!auth.authorized) return { error: auth.error };

    const updated = await prisma.dish.update({
      where: { id: dishId },
      data: { isAvailable },
      include: {
        category: {
          include: { restaurant: true },
        },
      },
    });

    revalidatePath(`/${updated.category.restaurant.slug}`);
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Error toggling dish availability:", error);
    return { error: "El plato no existe o ya fue eliminado." };
  }
}

// Super Admin Actions
export async function superAdminLoginAction(prevState: unknown, formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

    if (!superAdminEmail || !superAdminPassword) {
      console.error("Error en Auth: Faltan variables de entorno SUPER_ADMIN_EMAIL o SUPER_ADMIN_PASSWORD en el servidor de producción.");
      return { error: "Configuración de SuperAdmin no disponible en el servidor." };
    }

    if (!email || !password) {
      return { error: "Por favor complete todos los campos." };
    }

    const cleanEmail = email.toLowerCase().trim();

    if (cleanEmail !== superAdminEmail || password !== superAdminPassword) {
      console.warn(`[Auth Warning] Intento de login SuperAdmin fallido para: ${cleanEmail}`);
      return { error: "Correo o contraseña incorrectos." };
    }

    try {
      await setSuperAdminSession();
    } catch (saSessionErr) {
      console.error("Error en Auth (Sesión SuperAdmin JWT):", saSessionErr);
      return { error: "No se pudo crear la sesión de SuperAdmin." };
    }

    redirect("/super-admin");
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT") || error?.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Error en Auth:", error);
    return { error: "Ocurrió un error inesperado al iniciar sesión como SuperAdmin." };
  }
}

export async function superAdminLogoutAction() {
  try {
    await clearSuperAdminSession();
    redirect("/");
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT") || error?.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Error in superAdminLogoutAction:", error);
  }
}

export async function extendTrialAction(restaurantId: string, days: number) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) {
    return { error: "No autorizado. Acción reservada para SuperAdmin." };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId }
  });

  if (!restaurant) return { error: "Restaurante no encontrado." };

  const currentEnd = new Date(restaurant.trialEndsAt);
  const baseDate = currentEnd > new Date() ? currentEnd : new Date();
  baseDate.setDate(baseDate.getDate() + days);

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { trialEndsAt: baseDate }
  });

  revalidatePath("/super-admin");
  revalidatePath(`/${restaurant.slug}`);
  return { success: true };
}

export async function deleteRestaurantAction(restaurantId: string) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) {
    return { error: "No autorizado. Acción reservada para SuperAdmin." };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId }
  });

  if (!restaurant) return { error: "Restaurante no encontrado." };

  const userId = restaurant.userId;

  await prisma.restaurant.delete({
    where: { id: restaurantId }
  });

  const remainingRestaurants = await prisma.restaurant.count({
    where: { userId }
  });

  if (remainingRestaurants === 0) {
    try {
      await prismaControl.user.delete({
        where: { id: userId }
      });
    } catch (e) {
      console.warn("Could not delete user after restaurant deletion", e);
    }
  }

  revalidatePath("/super-admin");
  return { success: true };
}

export async function superAdminCreateRestaurantAction(data: {
  userName: string;
  email: string;
  password?: string;
  restaurantName: string;
  whatsapp: string;
  province: string;
  canton: string;
  parroquia: string;
  sector?: string;
  plan?: "FREE" | "PRO";
  existingUserId?: string;
}) {
  try {
    const isSuperAdmin = await getSuperAdminSession();
    if (!isSuperAdmin) {
      return { error: "No autorizado. Acción reservada para SuperAdmin." };
    }

    const cleanEmail = data.email.toLowerCase().trim();
    let assignedUserId = data.existingUserId || "";

    if (!assignedUserId) {
      let existingUser: any = null;
      try {
        existingUser = await prismaControl.user.findUnique({
          where: { email: cleanEmail }
        });
      } catch (dbErr: any) {
        console.error("Database error in superAdminCreateRestaurantAction:", dbErr);
        return { error: `Error al verificar el correo de usuario (${dbErr?.message || "fallo de BD"}).` };
      }

      if (existingUser) {
        assignedUserId = existingUser.id;
      } else {
        const hashedPassword = bcrypt.hashSync(data.password || "123456", 10);
        const user = await prismaControl.user.create({
          data: {
            name: data.userName || "Propietario",
            email: cleanEmail,
            password: hashedPassword,
          }
        });
        assignedUserId = user.id;
      }
    }

    let baseSlug = data.restaurantName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    if (!baseSlug) baseSlug = "restaurante";

    let cleanSlug = baseSlug;
    let isSlugTaken = true;
    let attempt = 0;

    while (isSlugTaken) {
      let existingRestaurant: any = null;
      try {
        existingRestaurant = await prismaTenant.restaurant.findUnique({
          where: { slug: cleanSlug }
        });
      } catch (e) {
        isSlugTaken = false;
        break;
      }
      if (!existingRestaurant) {
        isSlugTaken = false;
      } else {
        attempt++;
        cleanSlug = `${baseSlug}-${attempt}`;
      }
    }

    const localityParts = [data.province, data.canton, data.parroquia, data.sector].filter(Boolean);
    const locality = localityParts.length > 0 ? localityParts.join(", ") : null;

    await prismaTenant.restaurant.create({
      data: {
        userId: assignedUserId,
        name: data.restaurantName,
        slug: cleanSlug,
        whatsapp: data.whatsapp || "",
        locality,
        plan: data.plan || "FREE",
      }
    });

    revalidatePath("/super-admin");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating restaurant as super admin:", error);
    return { error: error?.message || "No se pudo crear el negocio. Revisa la conexión con la base de datos." };
  }
}

export async function superAdminUpdateRestaurantAction(
  restaurantId: string,
  data: {
    userName: string;
    email: string;
    restaurantName: string;
    slug: string;
    whatsapp: string;
    locality?: string;
    address?: string;
    slogan?: string;
    description?: string;
    schedule?: string;
    specialty?: string;
    plan: "FREE" | "PRO";
    bankName?: string;
    bankAccountType?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
    bankAccountDocument?: string;
    bankAccountEmail?: string;
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  }
) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) {
    return { error: "No autorizado. Acción reservada para SuperAdmin." };
  }

  const restaurant = await prismaTenant.restaurant.findUnique({
    where: { id: restaurantId }
  });

  if (!restaurant) {
    return { error: "Restaurante no encontrado." };
  }

  const ownerUser = await prismaControl.user.findUnique({
    where: { id: restaurant.userId }
  });

  const cleanEmail = data.email.toLowerCase().trim();
  const cleanSlug = data.slug.toLowerCase().trim();

  if (cleanSlug !== restaurant.slug) {
    const existingSlug = await prismaTenant.restaurant.findUnique({
      where: { slug: cleanSlug }
    });
    if (existingSlug && existingSlug.id !== restaurantId) {
      return { error: "El identificador (slug) ya está en uso por otro restaurante." };
    }
  }

  let finalUserId = restaurant.userId;

  if (cleanEmail && (!ownerUser || cleanEmail !== ownerUser.email)) {
    const targetUser = await prismaControl.user.findUnique({
      where: { email: cleanEmail }
    });
    if (targetUser) {
      finalUserId = targetUser.id;
    } else if (ownerUser) {
      await prismaControl.user.update({
        where: { id: ownerUser.id },
        data: {
          name: data.userName,
          email: cleanEmail,
        }
      });
    } else {
      const newUser = await prismaControl.user.create({
        data: {
          name: data.userName || "Propietario",
          email: cleanEmail,
          password: bcrypt.hashSync("123456", 10),
        }
      });
      finalUserId = newUser.id;
    }
  } else if (ownerUser && data.userName) {
    await prismaControl.user.update({
      where: { id: ownerUser.id },
      data: { name: data.userName }
    });
  }

  const futureTrial = new Date();
  futureTrial.setFullYear(futureTrial.getFullYear() + 1);

  const updatedRestaurant = await prismaTenant.restaurant.update({
    where: { id: restaurantId },
    data: {
      userId: finalUserId,
      name: data.restaurantName,
      slug: cleanSlug,
      whatsapp: data.whatsapp,
      locality: data.locality || null,
      address: data.address || null,
      slogan: data.slogan || null,
      description: data.description || null,
      schedule: data.schedule || null,
      specialty: data.specialty || null,
      plan: data.plan,
      ...(data.plan === "PRO" ? { trialEndsAt: futureTrial } : {}),
      bankName: data.bankName || null,
      bankAccountType: data.bankAccountType || null,
      bankAccountNumber: data.bankAccountNumber || null,
      bankAccountName: data.bankAccountName || null,
      bankAccountDocument: data.bankAccountDocument || null,
      bankAccountEmail: data.bankAccountEmail || null,
      instagram: data.instagram || null,
      facebook: data.facebook || null,
      tiktok: data.tiktok || null,
    }
  });

  revalidatePath("/super-admin");
  revalidatePath(`/${updatedRestaurant.slug}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function reassignRestaurantOwnerAction(restaurantId: string, ownerEmailOrUserId: string) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) return { error: "No autorizado. Acción reservada para SuperAdmin." };

  if (!ownerEmailOrUserId || !ownerEmailOrUserId.trim()) {
    return { error: "Por favor proporciona un correo o ID de usuario válido." };
  }

  const cleanTarget = ownerEmailOrUserId.trim();

  let targetUser = await prismaControl.user.findFirst({
    where: {
      OR: [
        { id: cleanTarget },
        { email: cleanTarget.toLowerCase() }
      ]
    }
  });

  if (!targetUser) {
    return { error: `No se encontró ningún usuario registrado con el correo o ID "${cleanTarget}".` };
  }

  const updatedRestaurant = await prismaTenant.restaurant.update({
    where: { id: restaurantId },
    data: { userId: targetUser.id }
  });

  revalidatePath("/super-admin");
  revalidatePath(`/${updatedRestaurant.slug}`);
  revalidatePath("/admin");

  return {
    success: true,
    message: `Negocio "${updatedRestaurant.name}" adjudicado con éxito al usuario ${targetUser.email} (${targetUser.name}).`
  };
}

export async function impersonateUserAction(userId: string) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) {
    return { error: "No autorizado. Acción reservada para SuperAdmin." };
  }

  const user = await prismaControl.user.findUnique({
    where: { id: userId }
  });
  if (!user) return { error: "Usuario no encontrado." };

  await setUserSession(user.id, user.email);
  redirect("/admin");
}

export async function changeUserPlanAction(restaurantId: string, plan: "FREE" | "PRO") {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) {
    return { error: "No autorizado. Acción reservada para SuperAdmin." };
  }

  const restaurant = await prismaTenant.restaurant.update({
    where: { id: restaurantId },
    data: { plan }
  });

  revalidatePath("/super-admin");
  revalidatePath(`/${restaurant.slug}`);
  return { success: true };
}

export async function subscribeToPremiumAction(
  restaurantId: string,
  paymentData?: {
    cardHolderName?: string;
    cardNumberLast4?: string;
    cardDocId?: string;
  }
) {
  const auth = await verifyRestaurantOwnership(restaurantId);
  if (!auth.authorized) return { error: auth.error };

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId }
  });

  if (!restaurant) {
    return { error: "Restaurante no encontrado." };
  }

  const apiKey = (process.env.PAYMENT_API_KEY || "").trim();
  const secretKey = (process.env.PAYMENT_SECRET_KEY || "").trim();
  const smartFieldsKey = (process.env.SMARTFIELDS_API_KEY || "").trim();

  if (!apiKey) {
    console.error("[subscribeToPremiumAction] Missing PAYMENT_API_KEY in process.env");
    return { error: "Configuración de pasarela de pagos no disponible. Por favor verifique las variables de entorno." };
  }

  console.log(`[Payment Gateway API] Processing subscription charge for restaurant ${restaurant.id}`);
  console.log(`[Payment Gateway API] Payment credentials configured: ${Boolean(smartFieldsKey && secretKey)}`);
  if (paymentData?.cardHolderName) {
    console.log(`[Payment Gateway API] Cardholder: ${paymentData.cardHolderName} | Last 4: **** ${paymentData.cardNumberLast4 || '****'}`);
  }

  const currentExpiry = restaurant.trialEndsAt ? new Date(restaurant.trialEndsAt) : new Date();
  const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + 1);

  const updatedRestaurant = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      plan: "PRO",
      trialEndsAt: newExpiry
    }
  });

  revalidatePath("/admin");
  revalidatePath("/super-admin");
  revalidatePath(`/${updatedRestaurant.slug}`);

  const cardSuffix = paymentData?.cardNumberLast4 ? ` finalizada en **** ${paymentData.cardNumberLast4}` : "";

  return {
    success: true,
    message: `¡Pago de $10.00 USD procesado con éxito con la tarjeta${cardSuffix}! Tu Plan Premium ha sido activado/renovado por 30 días.`,
    plan: updatedRestaurant.plan,
    trialEndsAt: updatedRestaurant.trialEndsAt.toISOString()
  };
}

export async function resetUserPasswordAction(userId: string, newPassword: string) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) {
    return { error: "No autorizado. Acción reservada para SuperAdmin." };
  }

  if (!newPassword || newPassword.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  await prismaControl.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });

  return { success: true };
}

export async function updateSystemSettingAction(key: string, value: string) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) {
    return { error: "No autorizado. Acción reservada para SuperAdmin." };
  }

  await prismaControl.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
  revalidatePath("/");
  revalidatePath("/super-admin");
  return { success: true };
}

export async function createOrderAction(data: {
  restaurantId: string;
  tableName: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  subtotal?: number;
  iva?: number;
  serviceCharge?: number;
  tip?: number;
  deliveryCost?: number;
  deliveryKmRateId?: string;
  seasonRateName?: string;
  seasonRateAmount?: number;
  couponCode?: string;
  discountAmount?: number;
  total?: number;
  paymentMethod: string;
  items: { dishId: string; dishName?: string; price?: number; quantity: number }[];
}) {
  try {
    if (!data.restaurantId || typeof data.restaurantId !== "string") {
      return { error: "ID de restaurante inválido." };
    }

    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      return { error: "El pedido debe contener al menos un producto." };
    }

    const rawMethod = (data.paymentMethod || "").trim().toLowerCase();
    const validMethods = ["cash", "efectivo", "qr", "deuna", "transferencia", "transfer", "tarjeta"];
    if (!rawMethod || !validMethods.includes(rawMethod)) {
      return { error: "Método de pago no válido." };
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: data.restaurantId },
      include: {
        seasonRates: {
          where: { isActive: true },
        },
      },
    });

    if (!restaurant) {
      return { error: "Restaurante no encontrado." };
    }

    // Map & lookup dishes by dishId
    const dishIds = Array.from(new Set(data.items.map((i) => i.dishId).filter(Boolean)));
    if (dishIds.length === 0) {
      return { error: "Los productos del pedido deben incluir un ID de plato válido." };
    }

    const dbDishes = await prisma.dish.findMany({
      where: {
        id: { in: dishIds },
      },
    });

    const dishMap = new Map(dbDishes.map((d) => [d.id, d]));

    let calculatedSubtotal = 0;
    const verifiedOrderItems: { dishName: string; price: number; quantity: number }[] = [];

    for (const item of data.items) {
      if (
        typeof item.quantity !== "number" ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > 50 ||
        !Number.isFinite(item.quantity)
      ) {
        return { error: "Cantidad inválida. Cada producto debe tener una cantidad entera entre 1 y 50." };
      }

      const dbDish = dishMap.get(item.dishId);
      if (!dbDish) {
        return { error: `Uno o más productos del pedido no existen.` };
      }

      // Multi-tenant protection (PASO 15)
      if (dbDish.restaurantId !== data.restaurantId) {
        return { error: `El producto "${dbDish.name}" no pertenece a este restaurante.` };
      }

      // Availability check (PASO 3)
      if (!dbDish.isAvailable) {
        return { error: `El producto "${dbDish.name}" no está disponible actualmente.` };
      }

      const serverPrice = dbDish.price;
      calculatedSubtotal += serverPrice * item.quantity;

      verifiedOrderItems.push({
        dishName: dbDish.name,
        price: serverPrice,
        quantity: item.quantity,
      });
    }

    // Coupon re-validation (PASO 10)
    let calculatedDiscount = 0;
    let verifiedCouponCode: string | null = null;

    if (data.couponCode && data.couponCode.trim()) {
      const cleanCode = data.couponCode.trim().toUpperCase();
      const coupon = await prisma.coupon.findFirst({
        where: {
          restaurantId: data.restaurantId,
          code: cleanCode,
        },
      });

      if (!coupon || !coupon.isActive) {
        return { error: "El cupón ingresado no existe o está inactivo." };
      }

      if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
        return { error: "El cupón ha expirado." };
      }

      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        return { error: "El cupón ha alcanzado su límite máximo de usos." };
      }

      if (calculatedSubtotal < coupon.minOrder) {
        return {
          error: `Este cupón requiere un consumo mínimo de $${coupon.minOrder.toFixed(2)}. Tu subtotal real es $${calculatedSubtotal.toFixed(2)}.`,
        };
      }

      verifiedCouponCode = coupon.code;
      if (coupon.discountType === "PERCENTAGE") {
        calculatedDiscount = (calculatedSubtotal * coupon.discountValue) / 100;
      } else {
        calculatedDiscount = Math.min(calculatedSubtotal, coupon.discountValue);
      }
      calculatedDiscount = Math.min(calculatedSubtotal, calculatedDiscount);
    }

    const subtotalAfterCoupon = Math.max(0, calculatedSubtotal - calculatedDiscount);

    // Season rates calculation
    const targetDateStr = new Date().toISOString().split("T")[0];
    const activeRate = (restaurant.seasonRates || []).find((r) => {
      const startStr = new Date(r.startDate).toISOString().split("T")[0];
      const endStr = new Date(r.endDate).toISOString().split("T")[0];
      return r.isActive && targetDateStr >= startStr && targetDateStr <= endStr;
    });

    let calculatedSeasonBonus = 0;
    let calculatedSeasonName: string | null = null;

    if (activeRate) {
      calculatedSeasonName = activeRate.name;
      calculatedSeasonBonus = (subtotalAfterCoupon * (activeRate.percentageBonus / 100)) + activeRate.fixedBonus;
    }

    // Taxes & Service Charge (PASO 6 & 7 - Global Business Rules)
    const baseForTax = subtotalAfterCoupon + calculatedSeasonBonus;

    const ivaPercent = restaurant.ivaPercent || 0;
    const servicePercent = restaurant.servicePercent || 0;

    // ivaOnTable represents if IVA is INCLUDED in dish prices (true = included, false = additional)
    const ivaIncluded = restaurant.ivaOnTable ?? false;
    // serviceOnTable represents if Service is INCLUDED in dish prices (true = included, false = additional)
    const serviceIncluded = restaurant.serviceOnTable ?? false;

    // IVA is added to checkout ONLY IF ivaPercent > 0 AND IVA is NOT included in prices
    const calculatedIva = (ivaPercent > 0 && !ivaIncluded)
      ? baseForTax * (ivaPercent / 100)
      : 0;

    // SERVICIO is added to checkout ONLY IF servicePercent > 0 AND Service is NOT included in prices
    const calculatedService = (servicePercent > 0 && !serviceIncluded)
      ? baseForTax * (servicePercent / 100)
      : 0;

    // Delivery cost (PASO 8)
    const rawTableName = (data.tableName || "Mesa Sin Número").trim();
    let calculatedDeliveryCost = 0;
    if (rawTableName === "Domicilio") {
      if (restaurant.deliveryRates) {
        try {
          const rates = JSON.parse(restaurant.deliveryRates);
          if (Array.isArray(rates) && rates.length > 0) {
            let selectedRate = null;
            if (data.deliveryKmRateId) {
              selectedRate = rates.find((r: any) => r.id === data.deliveryKmRateId);
            }
            if (!selectedRate) {
              selectedRate = rates[0];
            }
            if (selectedRate) {
              const minOrder = typeof selectedRate.minOrder === "number" ? selectedRate.minOrder : (typeof selectedRate.minPurchase === "number" ? selectedRate.minPurchase : 0);
              if (calculatedSubtotal < minOrder) {
                return { error: `Para la zona de envío seleccionada, el consumo mínimo es de $${minOrder.toFixed(2)}.` };
              }
              calculatedDeliveryCost = typeof selectedRate.price === "number" ? selectedRate.price : 0;
            } else {
              calculatedDeliveryCost = restaurant.deliveryCost;
            }
          } else {
            calculatedDeliveryCost = restaurant.deliveryCost;
          }
        } catch (e) {
          calculatedDeliveryCost = restaurant.deliveryCost;
        }
      } else {
        calculatedDeliveryCost = restaurant.deliveryCost;
      }
    }

    // Tip validation (PASO 9)
    let calculatedTip = 0;
    if (typeof data.tip === "number" && Number.isFinite(data.tip) && data.tip >= 0) {
      calculatedTip = Math.min(data.tip, 500);
    }

    // Rounding numbers (PASO 11 & 24)
    const round = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

    const finalSubtotal = round(calculatedSubtotal);
    const finalDiscount = round(calculatedDiscount);
    const finalSeasonBonus = round(calculatedSeasonBonus);
    const finalIva = round(calculatedIva);
    const finalService = round(calculatedService);
    const finalDelivery = round(calculatedDeliveryCost);
    const finalTip = round(calculatedTip);

    const finalTotal = round(
      finalSubtotal - finalDiscount + finalSeasonBonus + finalIva + finalService + finalDelivery + finalTip
    );

    // Save order within transaction (PASO 23)
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          restaurantId: data.restaurantId,
          tableName: rawTableName,
          customerName: data.customerName?.slice(0, 200) || null,
          customerPhone: data.customerPhone?.slice(0, 50) || null,
          customerAddress: data.customerAddress?.slice(0, 500) || null,
          subtotal: finalSubtotal,
          iva: finalIva,
          serviceCharge: finalService,
          tip: finalTip,
          deliveryCost: finalDelivery,
          seasonRateName: calculatedSeasonName,
          seasonRateAmount: finalSeasonBonus,
          couponCode: verifiedCouponCode,
          discountAmount: finalDiscount,
          total: finalTotal,
          paymentMethod: rawMethod,
          items: {
            create: verifiedOrderItems.map((item) => ({
              dishName: item.dishName,
              price: item.price,
              quantity: item.quantity,
            })),
          },
        },
      });

      // An open table bill is a visit snapshot. New orders are explicitly linked
      // so they are included without mixing an earlier closed visit at the same table.
      if (rawTableName !== "Domicilio") {
        const openSession = await tx.tableSession.findFirst({
          where: { restaurantId: data.restaurantId, tableName: rawTableName, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
          orderBy: { createdAt: "desc" },
        });
        if (openSession) {
          await tx.tableSessionOrder.create({ data: { tableSessionId: openSession.id, orderId: newOrder.id } });
          await tx.tableSession.update({ where: { id: openSession.id }, data: { totalAmount: openSession.totalAmount + finalTotal } });
        }
      }

      if (verifiedCouponCode) {
        await tx.coupon.updateMany({
          where: { restaurantId: data.restaurantId, code: verifiedCouponCode },
          data: { usedCount: { increment: 1 } },
        });
      }

      if (data.customerPhone && data.customerPhone.trim()) {
        const rawPhone = data.customerPhone.trim().slice(0, 50);
        const existing = await tx.customer.findFirst({
          where: { restaurantId: data.restaurantId, phone: rawPhone },
        });
        if (existing) {
          const newOrdersCount = existing.totalOrders + 1;
          const newCategory = newOrdersCount >= 5 ? "VIP" : newOrdersCount >= 2 ? "FRECUENTE" : existing.category;
          await tx.customer.update({
            where: { id: existing.id },
            data: {
              name: data.customerName?.slice(0, 200) || existing.name,
              address: data.customerAddress?.slice(0, 500) || existing.address,
              totalOrders: newOrdersCount,
              totalSpent: existing.totalSpent + finalTotal,
              category: newCategory,
              lastOrderAt: new Date(),
            },
          });
        } else {
          await tx.customer.create({
            data: {
              restaurantId: data.restaurantId,
              name: data.customerName?.slice(0, 200) || "Cliente",
              phone: rawPhone,
              address: data.customerAddress?.slice(0, 500) || null,
              totalOrders: 1,
              totalSpent: finalTotal,
              category: "NUEVO",
              lastOrderAt: new Date(),
            },
          });
        }
      }

      return newOrder;
    });

    try {
      revalidatePath(`/admin`);
      revalidatePath(`/${restaurant.slug}`);
      revalidatePath(`/${restaurant.slug}/rastreo`);
      revalidatePath(`/${restaurant.slug}/repartidor`);
    } catch {
      // Safe fallback when executed outside Next request context
    }

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber || 1
    };
  } catch (error: any) {
    console.error("Error creating order:", error);
    return { error: error?.message || "No se pudo guardar el pedido." };
  }
}

export async function updateOrderStatusAction(
  orderId: string,
  status: string,
  driverData?: { driverName?: string; driverPhone?: string }
) {
  try {
    await refreshUserSession();
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, restaurantId: true }
    });

    if (!order) {
      return { error: "Pedido no encontrado." };
    }

    const auth = await verifyRestaurantOwnership(order.restaurantId);
    if (!auth.authorized) return { error: auth.error };

    const updateData: any = { status };
    if (driverData?.driverName !== undefined) {
      updateData.driverName = driverData.driverName;
    }
    if (driverData?.driverPhone !== undefined) {
      updateData.driverPhone = driverData.driverPhone;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: { restaurant: { select: { slug: true } } }
    });

    revalidatePath(`/admin`);
    revalidatePath(`/${updatedOrder.restaurant.slug}`);
    revalidatePath(`/${updatedOrder.restaurant.slug}/rastreo`);
    revalidatePath(`/${updatedOrder.restaurant.slug}/repartidor`);
    return { success: true };
  } catch (error) {
    console.error("Error updating order status:", error);
    return { error: "No se pudo actualizar el estado del pedido." };
  }
}

export async function getOrderTrackingAction(restaurantSlug?: string | null, querySearch?: string | null) {
  try {
    if (!querySearch || !querySearch.trim()) {
      return { error: "Por favor ingrese un número de pedido o teléfono." };
    }

    const cleanQuery = querySearch.trim().replace(/^#/, "");
    const isNumeric = /^\d+$/.test(cleanQuery);
    const parsedNumber = isNumeric ? parseInt(cleanQuery, 10) : null;

    let whereClause: any = {};

    if (restaurantSlug) {
      const restaurant = await prisma.restaurant.findUnique({
        where: { slug: restaurantSlug }
      });

      if (!restaurant) {
        return { error: "Restaurante no encontrado." };
      }

      whereClause.restaurantId = restaurant.id;
    }

    const OR_CONDITIONS: any[] = [];
    if (parsedNumber !== null && !isNaN(parsedNumber)) {
      OR_CONDITIONS.push({ orderNumber: parsedNumber });
    }
    OR_CONDITIONS.push({ id: cleanQuery });
    OR_CONDITIONS.push({ customerPhone: { contains: cleanQuery } });

    whereClause.OR = OR_CONDITIONS;

    const orders = await prisma.order.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        items: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            whatsapp: true,
            themeColor: true,
            address: true,
          }
        }
      }
    });

    if (!orders || orders.length === 0) {
      return { error: `No se encontraron pedidos con el número o teléfono "${querySearch}". Verifique la información e intente nuevamente.` };
    }

    return { success: true, orders };
  } catch (error) {
    console.error("Error fetching order tracking:", error);
    return { error: "Ocurrió un error al buscar la información del pedido." };
  }
}

export async function getDeliveryOrdersAction(restaurantSlug: string) {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: restaurantSlug },
      select: { id: true, name: true, slug: true, whatsapp: true, logoUrl: true, themeColor: true }
    });

    if (!restaurant) {
      return { error: "Restaurante no encontrado." };
    }

    const auth = await verifyRestaurantOwnership(restaurant.id);
    if (!auth.authorized) return { error: auth.error };

    const orders = await prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        tableName: "Domicilio",
        status: { in: ["PENDING", "PREPARING", "IN_TRANSIT", "DELIVERED"] }
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        items: true,
      }
    });

    const serializedOrders = orders.map((o: any) => ({
      ...o,
      createdAt: typeof o.createdAt === "string" ? o.createdAt : o.createdAt.toISOString(),
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : o.updatedAt.toISOString(),
      items: o.items || [],
    }));

    return { success: true, restaurant, orders: serializedOrders };
  } catch (error) {
    console.error("Error fetching delivery orders:", error);
    return { error: "No se pudieron cargar los pedidos a domicilio." };
  }
}

export async function updateRestaurantTablesAction(restaurantId: string, tablesConfig: string) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { tablesConfig }
    });

    revalidatePath(`/admin`);
    revalidatePath(`/${restaurant.slug}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating tables config:", error);
    return { error: "No se pudo actualizar la configuración de mesas." };
  }
}

export async function updateRestaurantChargesConfigAction(
  restaurantId: string,
  data: {
    ivaPercent: number;
    servicePercent: number;
    deliveryCost: number;
    deliveryEnabled: boolean;
    deliveryRates?: string | null;
    ivaOnTable: boolean;
    ivaOnTakeout: boolean;
    serviceOnTable: boolean;
    serviceOnTakeout: boolean;
  }
) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        ivaPercent: data.ivaPercent,
        servicePercent: data.servicePercent,
        deliveryCost: data.deliveryCost,
        deliveryEnabled: data.deliveryEnabled,
        deliveryRates: data.deliveryRates || null,
        ivaOnTable: data.ivaOnTable,
        ivaOnTakeout: data.ivaOnTakeout,
        serviceOnTable: data.serviceOnTable,
        serviceOnTakeout: data.serviceOnTakeout,
      }
    });

    revalidatePath(`/admin`);
    revalidatePath(`/${restaurant.slug}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating charges config:", error);
    return { error: "No se pudo actualizar la configuración de recargos." };
  }
}

// Password Recovery Actions
export async function requestPasswordResetAction(prevState: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  if (!email) {
    return { error: "Por favor ingresa un correo electrónico." };
  }

  const cleanEmail = email.toLowerCase().trim();

  const user = await prismaControl.user.findUnique({
    where: { email: cleanEmail },
  });

  if (!user) {
    return {
      success: true,
      message: "Si tu correo está registrado, recibirás un mensaje con las instrucciones para restablecer tu contraseña.",
    };
  }

  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000);

  await prismaControl.user.update({
    where: { id: user.id },
    data: {
      resetToken: token,
      resetTokenExpiry: expiry,
    },
  });

  const emailResult = await sendPasswordResetEmail(cleanEmail, token);

  if (!emailResult.success) {
    return { error: emailResult.error || "Ocurrió un error al enviar el correo de recuperación." };
  }

  return {
    success: true,
    message: "Si tu correo está registrado, recibirás un mensaje con las instrucciones para restablecer tu contraseña.",
  };
}

export async function resetPasswordAction(prevState: unknown, formData: FormData) {
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token) {
    return { error: "El token de recuperación es inválido o no existe." };
  }

  if (!password || !confirmPassword) {
    return { error: "Por favor complete todos los campos." };
  }

  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const user = await prismaControl.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    return { error: "El enlace de recuperación es inválido o ha expirado. Por favor solicita uno nuevo." };
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  await prismaControl.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  return {
    success: true,
    message: "¡Tu contraseña ha sido actualizada con éxito! Ya puedes iniciar sesión.",
  };
}

// CRM Server Actions
export async function updateRestaurantLeadStatusAction(
  restaurantId: string,
  leadStatus: string,
  nextFollowUpAt?: string | null
) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) return { error: "No autorizado. Acción reservada para SuperAdmin." };

  await prismaTenant.restaurant.update({
    where: { id: restaurantId },
    data: {
      leadStatus,
      nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null,
    },
  });

  revalidatePath("/super-admin");
  return { success: true };
}

export async function addCrmNoteAction(
  target: { restaurantId?: string; leadId?: string },
  content: string
) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) return { error: "No autorizado. Acción reservada para SuperAdmin." };

  if (!content.trim()) return { error: "El contenido de la nota no puede estar vacío." };

  await prismaControl.crmNote.create({
    data: {
      leadId: target.leadId || null,
      content: content.trim(),
      author: "SuperAdmin",
    },
  });

  revalidatePath("/super-admin");
  return { success: true };
}

export async function createProspectLeadAction(data: {
  name: string;
  ownerName?: string;
  phone: string;
  email?: string;
  city?: string;
  notes?: string;
  nextFollowUpAt?: string;
}) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) return { error: "No autorizado. Acción reservada para SuperAdmin." };

  if (!data.name || !data.phone) {
    return { error: "El nombre del negocio y el teléfono son requeridos." };
  }

  await prismaControl.lead.create({
    data: {
      name: data.name.trim(),
      ownerName: data.ownerName?.trim() || null,
      phone: data.phone.trim(),
      email: data.email?.toLowerCase().trim() || null,
      city: data.city?.trim() || null,
      notes: data.notes?.trim() || null,
      nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null,
    },
  });

  revalidatePath("/super-admin");
  return { success: true };
}

export async function updateProspectLeadAction(
  leadId: string,
  data: {
    name: string;
    ownerName?: string;
    phone: string;
    email?: string;
    city?: string;
    status?: string;
    notes?: string;
    nextFollowUpAt?: string | null;
  }
) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) return { error: "No autorizado. Acción reservada para SuperAdmin." };

  await prismaControl.lead.update({
    where: { id: leadId },
    data: {
      name: data.name.trim(),
      ownerName: data.ownerName?.trim() || null,
      phone: data.phone.trim(),
      email: data.email?.toLowerCase().trim() || null,
      city: data.city?.trim() || null,
      status: data.status || "NUEVO",
      notes: data.notes?.trim() || null,
      nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null,
    },
  });

  revalidatePath("/super-admin");
  return { success: true };
}

export async function deleteProspectLeadAction(leadId: string) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) return { error: "No autorizado. Acción reservada para SuperAdmin." };

  await prismaControl.lead.delete({
    where: { id: leadId },
  });

  revalidatePath("/super-admin");
  return { success: true };
}

export async function convertProspectToRestaurantAction(leadId: string, password: string) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) return { error: "No autorizado. Acción reservada para SuperAdmin." };

  const lead = await prismaControl.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) return { error: "Prospecto no encontrado." };

  const email = lead.email || `lead-${lead.id.substring(0, 6)}@menuqrpro.com`;
  const ownerName = lead.ownerName || lead.name;

  const existingUser = await prismaControl.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: "El correo ya está registrado en el sistema. Utiliza otro correo." };
  }

  const res = await superAdminCreateRestaurantAction({
    userName: ownerName,
    email,
    password,
    restaurantName: lead.name,
    whatsapp: lead.phone,
    province: lead.city || "Ecuador",
    canton: lead.city || "Ciudad",
    parroquia: "Centro",
    plan: "FREE",
  });

  if (res.error) return { error: res.error };

  await prismaControl.lead.update({
    where: { id: leadId },
    data: { status: "CONVERTIDO" },
  });

  revalidatePath("/super-admin");
  return { success: true };
}

// Season & Holiday Rates Server Actions
export async function createSeasonRateAction(
  restaurantId: string,
  data: {
    name: string;
    startDate: string;
    endDate: string;
    percentageBonus: number;
    fixedBonus: number;
    isHoliday: boolean;
  }
) {
  await refreshUserSession();
  const auth = await verifyRestaurantOwnership(restaurantId);
  if (!auth.authorized) return { error: auth.error };

  if (!data.name || !data.startDate || !data.endDate) {
    return { error: "El nombre de la tarifa y las fechas de inicio y fin son obligatorios." };
  }

  const rate = await prisma.seasonRate.create({
    data: {
      restaurantId,
      name: data.name.trim(),
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      percentageBonus: data.percentageBonus || 0,
      fixedBonus: data.fixedBonus || 0,
      isHoliday: data.isHoliday || false,
      isActive: true,
    },
    include: {
      restaurant: { select: { slug: true } },
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/${rate.restaurant.slug}`);
  return { success: true };
}

export async function updateSeasonRateAction(
  rateId: string,
  data: {
    name: string;
    startDate: string;
    endDate: string;
    percentageBonus: number;
    fixedBonus: number;
    isHoliday: boolean;
  }
) {
  await refreshUserSession();
  const rate = await prisma.seasonRate.findUnique({
    where: { id: rateId },
    select: { id: true, restaurantId: true },
  });
  if (!rate) return { error: "Tarifa no encontrada." };

  const auth = await verifyRestaurantOwnership(rate.restaurantId);
  if (!auth.authorized) return { error: auth.error };

  const updatedRate = await prisma.seasonRate.update({
    where: { id: rateId },
    data: {
      name: data.name.trim(),
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      percentageBonus: data.percentageBonus || 0,
      fixedBonus: data.fixedBonus || 0,
      isHoliday: data.isHoliday || false,
    },
    include: {
      restaurant: { select: { slug: true } },
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/${updatedRate.restaurant.slug}`);
  return { success: true };
}

export async function deleteSeasonRateAction(rateId: string) {
  await refreshUserSession();
  const rate = await prisma.seasonRate.findUnique({
    where: { id: rateId },
    select: { id: true, restaurantId: true },
  });
  if (!rate) return { error: "Tarifa no encontrada." };

  const auth = await verifyRestaurantOwnership(rate.restaurantId);
  if (!auth.authorized) return { error: auth.error };

  const deleted = await prisma.seasonRate.delete({
    where: { id: rateId },
    include: {
      restaurant: { select: { slug: true } },
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/${deleted.restaurant.slug}`);
  return { success: true };
}

export async function toggleSeasonRateAction(rateId: string, isActive: boolean) {
  await refreshUserSession();
  const rate = await prisma.seasonRate.findUnique({
    where: { id: rateId },
    select: { id: true, restaurantId: true },
  });
  if (!rate) return { error: "Tarifa no encontrada." };

  const auth = await verifyRestaurantOwnership(rate.restaurantId);
  if (!auth.authorized) return { error: auth.error };

  const updated = await prisma.seasonRate.update({
    where: { id: rateId },
    data: { isActive },
    include: {
      restaurant: { select: { slug: true } },
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/${updated.restaurant.slug}`);
  return { success: true };
}

// CRM Customer Actions
export async function createCustomerAction(data: {
  restaurantId: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  category?: string;
  notes?: string;
}) {
  await refreshUserSession();
  const auth = await verifyRestaurantOwnership(data.restaurantId);
  if (!auth.authorized) return { error: auth.error };

  try {
    const customer = await prisma.customer.create({
      data: {
        restaurantId: data.restaurantId,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        category: data.category || "NUEVO",
        notes: data.notes || null,
      },
    });

    revalidatePath("/admin");
    return { success: true, customer };
  } catch (error) {
    console.error("Error creating customer:", error);
    return { error: "No se pudo registrar el cliente." };
  }
}

export async function updateCustomerAction(
  customerId: string,
  data: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    category?: string;
    notes?: string;
  }
) {
  await refreshUserSession();
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, restaurantId: true },
  });
  if (!customer) return { error: "Cliente no encontrado." };

  const auth = await verifyRestaurantOwnership(customer.restaurantId);
  if (!auth.authorized) return { error: auth.error };

  try {
    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        category: data.category,
        notes: data.notes || null,
      },
    });

    revalidatePath("/admin");
    return { success: true, customer: updated };
  } catch (error) {
    console.error("Error updating customer:", error);
    return { error: "No se pudo actualizar el cliente." };
  }
}

export async function deleteCustomerAction(customerId: string) {
  await refreshUserSession();
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, restaurantId: true },
  });
  if (!customer) return { error: "Cliente no encontrado." };

  const auth = await verifyRestaurantOwnership(customer.restaurantId);
  if (!auth.authorized) return { error: auth.error };

  try {
    await prisma.customer.delete({
      where: { id: customerId },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Error deleting customer:", error);
    return { error: "No se pudo eliminar el cliente." };
  }
}

export async function importCustomersAction(
  restaurantId: string,
  customers: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    city?: string;
    category?: string;
    notes?: string;
  }[]
) {
  await refreshUserSession();
  const auth = await verifyRestaurantOwnership(restaurantId);
  if (!auth.authorized) return { error: auth.error };

  let importedCount = 0;
  let updatedCount = 0;

  try {
    for (const item of customers) {
      if (!item.name || !item.phone) continue;
      const cleanPhone = item.phone.trim();
      if (!cleanPhone) continue;

      const existing = await prisma.customer.findFirst({
        where: { restaurantId, phone: cleanPhone },
      });

      if (existing) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: {
            name: item.name.trim() || existing.name,
            email: item.email?.trim() || existing.email,
            address: item.address?.trim() || existing.address,
            city: item.city?.trim() || existing.city,
            notes: item.notes?.trim() || existing.notes,
          },
        });
        updatedCount++;
      } else {
        await prisma.customer.create({
          data: {
            restaurantId,
            name: item.name.trim(),
            phone: cleanPhone,
            email: item.email?.trim() || null,
            address: item.address?.trim() || null,
            city: item.city?.trim() || null,
            category: item.category || "NUEVO",
            notes: item.notes?.trim() || null,
          },
        });
        importedCount++;
      }
    }

    revalidatePath("/admin");
    return { success: true, importedCount, updatedCount };
  } catch (error) {
    console.error("Error importing customers:", error);
    return { error: "Ocurrió un error al importar la lista de contactos." };
  }
}

// Coupon System Server Actions
export async function getRestaurantCouponsAction(restaurantId: string) {
  try {
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { coupons: [], error: auth.error };

    const coupons = await prisma.coupon.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
    });
    return { coupons };
  } catch (error: any) {
    console.error("Error fetching coupons:", error);
    return { coupons: [], error: error?.message || "No se pudieron obtener los cupones." };
  }
}

export async function createCouponAction(
  restaurantId: string,
  data: {
    code: string;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
    minOrder?: number;
    maxUses?: number | null;
    expiresAt?: string | null;
  }
) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    const cleanCode = data.code.trim().toUpperCase();

    if (!cleanCode) {
      return { error: "El código del cupón es obligatorio." };
    }

    if (data.discountValue <= 0) {
      return { error: "El valor del descuento debe ser mayor a 0." };
    }

    if (data.discountType === "PERCENTAGE" && data.discountValue > 100) {
      return { error: "El porcentaje de descuento no puede ser mayor al 100%." };
    }

    const existing = await prisma.coupon.findFirst({
      where: {
        restaurantId,
        code: cleanCode,
      },
    });

    if (existing) {
      return { error: `Ya existe un cupón con el código "${cleanCode}" para este restaurante.` };
    }

    let parsedExpiresAt: Date | null = null;
    if (data.expiresAt && typeof data.expiresAt === "string" && data.expiresAt.trim() !== "") {
      const d = new Date(data.expiresAt);
      if (!isNaN(d.getTime())) {
        parsedExpiresAt = d;
      }
    }

    const coupon = await prisma.coupon.create({
      data: {
        restaurantId,
        code: cleanCode,
        discountType: data.discountType,
        discountValue: Number(data.discountValue),
        minOrder: Number(data.minOrder) || 0,
        maxUses: data.maxUses ? Math.max(1, Number(data.maxUses)) : null,
        expiresAt: parsedExpiresAt,
      },
    });

    revalidatePath("/admin");
    return { success: true, coupon };
  } catch (error: any) {
    console.error("Error creating coupon:", error);
    return { error: error?.message || "No se pudo crear el cupón de descuento." };
  }
}

export async function deleteCouponAction(couponId: string, restaurantId: string) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    await prisma.coupon.deleteMany({
      where: { id: couponId, restaurantId },
    });
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting coupon:", error);
    return { error: error?.message || "No se pudo eliminar el cupón." };
  }
}

export async function toggleCouponStatusAction(couponId: string, restaurantId: string) {
  try {
    await refreshUserSession();
    const auth = await verifyRestaurantOwnership(restaurantId);
    if (!auth.authorized) return { error: auth.error };

    const coupon = await prisma.coupon.findFirst({
      where: { id: couponId, restaurantId },
    });
    if (!coupon) return { error: "Cupón no encontrado." };

    await prisma.coupon.update({
      where: { id: couponId },
      data: { isActive: !coupon.isActive },
    });
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Error toggling coupon status:", error);
    return { error: error?.message || "No se pudo actualizar el estado del cupón." };
  }
}

export async function validateCouponAction(restaurantId: string, code: string, subtotal: number) {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return { error: "Ingresa un código de cupón." };

  try {
    const coupon = await prisma.coupon.findFirst({
      where: {
        restaurantId,
        code: cleanCode,
      },
    });

    if (!coupon || !coupon.isActive) {
      return { error: "El cupón ingresado no existe o está inactivo." };
    }

    if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
      return { error: "El cupón ha expirado." };
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return { error: "El cupón ha alcanzado su límite máximo de usos." };
    }

    if (subtotal < coupon.minOrder) {
      return {
        error: `Este cupón requiere un consumo mínimo de $${coupon.minOrder.toFixed(2)}. Tu subtotal actual es de $${subtotal.toFixed(2)}.`,
      };
    }

    let discountAmount = 0;
    if (coupon.discountType === "PERCENTAGE") {
      discountAmount = (subtotal * coupon.discountValue) / 100;
    } else {
      discountAmount = Math.min(subtotal, coupon.discountValue);
    }

    return {
      success: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: Number(discountAmount.toFixed(2)),
      },
    };
  } catch (error: any) {
    console.error("Error validating coupon:", error);
    return { error: error?.message || "No se pudo validar el cupón." };
  }
}
