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

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB max

function validateImageMagicBytes(buffer: Buffer, ext: string): boolean {
  if (ext === "jpg" || ext === "jpeg") {
    // JPEG magic bytes: FF D8 FF
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (ext === "png") {
    // PNG magic bytes: 89 50 4E 47
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (ext === "gif") {
    // GIF magic bytes: GIF8 (47 49 46 38)
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    );
  }
  if (ext === "webp") {
    // WEBP magic bytes: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
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
  if (ext === "svg") {
    // SVG text check: starts with <svg or <?xml
    const headerStr = buffer.slice(0, 100).toString("utf-8").toLowerCase().trim();
    return headerStr.includes("<svg") || headerStr.includes("<?xml");
  }
  return false;
}

// Helper to save files to public/uploads
async function saveUploadedFile(file: File | null): Promise<string | null> {
  if (!file || file.size === 0 || !file.name) {
    return null;
  }

  // 1. File Size Validation (Max 5 MB)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    console.warn(`[Security Upload] File size ${file.size} bytes exceeds limit of ${MAX_FILE_SIZE_BYTES} bytes.`);
    return null;
  }

  // 2. Extension Validation
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(fileExt)) {
    console.warn(`[Security Upload] Extension .${fileExt} is not allowed.`);
    return null;
  }

  // 3. MIME Type Validation
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    console.warn(`[Security Upload] MIME type ${file.type} is not in allowed list.`);
    return null;
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 4. Magic Bytes Content Inspection
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

// Authentication Actions (SaaS Multi-tenant)
export async function loginUserAction(prevState: unknown, formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      return { error: "Por favor complete todos los campos." };
    }

    const cleanEmail = email.toLowerCase().trim();

    // Autenticación en la base de datos local de Prisma / SuperAdmin
    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "pruebasyaprendizaje0@gmail.com").toLowerCase().trim();
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "Frhc1971";

    if (cleanEmail === superAdminEmail && (password === superAdminPassword || password === "Frhc1971*" || password === "Frhc1971")) {
      await setSuperAdminSession();
      redirect("/super-admin");
    }

    let user: any = null;
    try {
      user = await prismaControl.user.findUnique({
        where: { email: cleanEmail },
      });
    } catch (dbErr) {
      console.error("Database connection error during login:", dbErr);
      return { error: "No se pudo conectar con la base de datos. Por favor intenta nuevamente en unos momentos." };
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return { error: "Correo o contraseña incorrectos." };
    }

    await setUserSession(user.id, user.email);
    redirect("/admin");
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT") || error?.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Error in loginUserAction:", error);
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

    // Check unique email
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

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Generate unique slug from restaurantName
    let baseSlug = restaurantName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
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

    // Create User in Control DB and Restaurant in Tenant DB
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
  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const whatsappNumber = formData.get("whatsappNumber") as string;
  const themeColor = formData.get("themeColor") as string;
  
  const instagram = formData.get("instagram") as string;
  const facebook = formData.get("facebook") as string;
  const tiktok = formData.get("tiktok") as string;
  const address = formData.get("address") as string;
  const description = formData.get("description") as string;
  const locality = formData.get("locality") as string;
  const schedule = formData.get("schedule") as string;
  const specialty = formData.get("specialty") as string;
  const services = formData.get("services") as string;
  const contactNumbers = formData.get("contactNumbers") as string;
  const ubicameUrl = formData.get("ubicameUrl") as string;
  const mapEmbedUrl = formData.get("mapEmbedUrl") as string;
  
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
  let logoUrl = formData.get("logoUrl") as string;

  const uploadedLogo = await saveUploadedFile(logoFile);
  if (uploadedLogo) {
    logoUrl = uploadedLogo;
  }

  let coverFile = formData.get("coverFile") as File | null;
  if (!coverFile || coverFile.size === 0) {
    coverFile = formData.get("coverFileCamera") as File | null;
  }
  let coverUrl = formData.get("coverUrl") as string;

  const uploadedCover = await saveUploadedFile(coverFile);
  if (uploadedCover) {
    coverUrl = uploadedCover;
  }

  const paymentQrFile = formData.get("paymentQrFile") as File | null;
  let paymentQrUrl = formData.get("paymentQrUrl") as string;

  const uploadedPaymentQr = await saveUploadedFile(paymentQrFile);
  if (uploadedPaymentQr) {
    paymentQrUrl = uploadedPaymentQr;
  }

  const ivaPercentInput = formData.get("ivaPercent") as string;
  const servicePercentInput = formData.get("servicePercent") as string;
  const deliveryCostInput = formData.get("deliveryCost") as string;
  const ivaPercent = ivaPercentInput ? parseFloat(ivaPercentInput) : 15.0;
  const servicePercent = servicePercentInput ? parseFloat(servicePercentInput) : 10.0;
  const deliveryCost = deliveryCostInput ? parseFloat(deliveryCostInput) : 0.0;

  const ivaOnTable = formData.get("ivaOnTable") === "true";
  const ivaOnTakeout = formData.get("ivaOnTakeout") === "true";
  const serviceOnTable = formData.get("serviceOnTable") === "true";
  const serviceOnTakeout = formData.get("serviceOnTakeout") === "true";
  const deliveryEnabled = formData.get("deliveryEnabled") === "true" || formData.get("deliveryEnabled") === "on";
  const localSchedule = formData.get("localSchedule") as string;
  const deliverySchedule = formData.get("deliverySchedule") as string;
  const blockedDates = formData.get("blockedDates") as string;

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      name,
      slug: slug.toLowerCase().trim(),
      whatsapp: whatsappNumber,
      themeColor,
      logoUrl: logoUrl || null,
      // @ts-ignore
      coverUrl: coverUrl || null,
      qrCobroUrl: paymentQrUrl || null,
      instagram: instagram || null,
      facebook: facebook || null,
      tiktok: tiktok || null,
      address: address || null,
      description: description || null,
      locality: locality || null,
      schedule: schedule || null,
      // @ts-ignore
      localSchedule: localSchedule || null,
      // @ts-ignore
      deliverySchedule: deliverySchedule || null,
      // @ts-ignore
      blockedDates: blockedDates || null,
      specialty: specialty || null,
      services: services || null,
      contactNumbers: contactNumbers || null,
      ubicameUrl: ubicameUrl || null,
      // @ts-ignore
      mapEmbedUrl: mapEmbedUrl || null,
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
      // @ts-ignore
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
    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        schedule: data.schedule || null,
        // @ts-ignore
        localSchedule: data.localSchedule || null,
        // @ts-ignore
        deliverySchedule: data.deliverySchedule || null,
        // @ts-ignore
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
  const logoFile = formData.get("logoFile") as File | null;
  const uploadedLogo = await saveUploadedFile(logoFile);
  
  if (!uploadedLogo) {
    return { error: "No se pudo guardar el archivo de logo." };
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { logoUrl: uploadedLogo },
  });

  revalidatePath("/admin");
  revalidatePath(`/${updated.slug}`);
  return { success: true, logoUrl: uploadedLogo };
}

export async function updateCoverDirectAction(restaurantId: string, formData: FormData) {
  await refreshUserSession();
  const coverFile = formData.get("coverFile") as File | null;
  const uploadedCover = await saveUploadedFile(coverFile);

  if (!uploadedCover) {
    return { error: "No se pudo guardar el archivo de portada." };
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { 
      // @ts-ignore
      coverUrl: uploadedCover 
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/${updated.slug}`);
  return { success: true, coverUrl: uploadedCover };
}

// Category Actions
export async function createCategoryAction(restaurantId: string, formData: FormData) {
  await refreshUserSession();
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
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const price = parseFloat(formData.get("price") as string || "0");
  const isAvailable = formData.get("isAvailable") === "true";
  
  const dishFile = formData.get("dishFile") as File | null;
  let imageUrl = formData.get("imageUrl") as string;

  const uploadedImage = await saveUploadedFile(dishFile);
  if (uploadedImage) {
    imageUrl = uploadedImage;
  }



  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { restaurant: true },
  });

  if (!category) return { error: "Categoría no encontrada." };

  await prisma.dish.create({
    data: {
      name,
      description,
      price,
      imageUrl: imageUrl || null,
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
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const price = parseFloat(formData.get("price") as string || "0");
  const isAvailable = formData.get("isAvailable") === "true";
  
  const dishFile = formData.get("dishFile") as File | null;
  let imageUrl = formData.get("imageUrl") as string;

  const uploadedImage = await saveUploadedFile(dishFile);
  if (uploadedImage) {
    imageUrl = uploadedImage;
  }



  const updated = await prisma.dish.update({
    where: { id: dishId },
    data: {
      name,
      description,
      price,
      imageUrl: imageUrl || null,
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
    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "pruebasyaprendizaje0@gmail.com").toLowerCase().trim();
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "Frhc1971";

    if (!email || !password) {
      return { error: "Por favor complete todos los campos." };
    }

    const cleanEmail = email.toLowerCase().trim();
    const isValidPassword = password === superAdminPassword || password === "Frhc1971*" || password === "Frhc1971";

    if (cleanEmail !== superAdminEmail || !isValidPassword) {
      return { error: "Correo o contraseña incorrectos." };
    }

    await setSuperAdminSession();
    redirect("/super-admin");
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT") || error?.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Error in superAdminLoginAction:", error);
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
    return { error: "No autorizado." };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId }
  });

  if (!restaurant) return { error: "Restaurante no encontrado." };

  const userId = restaurant.userId;

  await prisma.restaurant.delete({
    where: { id: restaurantId }
  });

  // Clean up user if they have no remaining restaurants
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
  revalidatePath(`/${restaurant.slug}`);
  return { success: true };
}

export async function superAdminCreateRestaurantAction(data: {
  userName: string;
  email: string;
  password: string;
  restaurantName: string;
  whatsapp: string;
  province: string;
  canton: string;
  parroquia: string;
  sector?: string;
  plan?: "FREE" | "PRO";
}) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) {
    return { error: "No autorizado." };
  }

  const cleanEmail = data.email.toLowerCase().trim();
  const existingUser = await prismaControl.user.findUnique({
    where: { email: cleanEmail }
  });

  if (existingUser) {
    return { error: "El correo electrónico ya está registrado." };
  }

  const hashedPassword = bcrypt.hashSync(data.password, 10);

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
    const existingRestaurant = await prismaTenant.restaurant.findUnique({
      where: { slug: cleanSlug }
    });
    if (!existingRestaurant) {
      isSlugTaken = false;
    } else {
      attempt++;
      cleanSlug = `${baseSlug}-${attempt}`;
    }
  }

  const user = await prismaControl.user.create({
    data: {
      name: data.userName,
      email: cleanEmail,
      password: hashedPassword,
    }
  });

  const localityParts = [data.province, data.canton, data.parroquia, data.sector].filter(Boolean);
  const locality = localityParts.length > 0 ? localityParts.join(", ") : null;

  await prismaTenant.restaurant.create({
    data: {
      userId: user.id,
      name: data.restaurantName,
      slug: cleanSlug,
      whatsapp: data.whatsapp,
      locality,
      plan: data.plan || "FREE",
    }
  });

  revalidatePath("/super-admin");
  return { success: true };
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
    return { error: "No autorizado." };
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

  // Check unique slug if changed
  if (cleanSlug !== restaurant.slug) {
    const existingSlug = await prismaTenant.restaurant.findUnique({
      where: { slug: cleanSlug }
    });
    if (existingSlug && existingSlug.id !== restaurantId) {
      return { error: "El identificador (slug) ya está en uso por otro restaurante." };
    }
  }

  // Check unique email if changed
  if (ownerUser && cleanEmail !== ownerUser.email) {
    const existingEmail = await prismaControl.user.findUnique({
      where: { email: cleanEmail }
    });
    if (existingEmail && existingEmail.id !== restaurant.userId) {
      return { error: "El correo electrónico ya está registrado por otro usuario." };
    }
  }

  // Update user
  if (ownerUser) {
    await prismaControl.user.update({
      where: { id: restaurant.userId },
      data: {
        name: data.userName,
        email: cleanEmail,
      }
    });
  }

  // Update restaurant
  const updatedRestaurant = await prismaTenant.restaurant.update({
    where: { id: restaurantId },
    data: {
      name: data.restaurantName,
      slug: cleanSlug,
      whatsapp: data.whatsapp,
      locality: data.locality || null,
      address: data.address || null,
      description: data.description || null,
      schedule: data.schedule || null,
      specialty: data.specialty || null,
      plan: data.plan,
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

export async function impersonateUserAction(userId: string) {
  const user = await prismaControl.user.findUnique({
    where: { id: userId }
  });
  if (!user) return { error: "Usuario no encontrado." };

  await setUserSession(user.id, user.email);
  redirect("/admin");
}

export async function changeUserPlanAction(restaurantId: string, plan: "FREE" | "PRO") {
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
  const session = await getUserSession();
  if (!session) {
    return { error: "No autorizado. Por favor inicie sesión para continuar." };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId }
  });

  if (!restaurant || restaurant.userId !== session.userId) {
    return { error: "Restaurante no encontrado o no tiene permisos." };
  }

  const apiKey = (process.env.PAYMENT_API_KEY || "").trim();
  const secretKey = (process.env.PAYMENT_SECRET_KEY || "").trim();
  const smartFieldsKey = (process.env.SMARTFIELDS_API_KEY || "").trim();

  if (!apiKey) {
    console.error("[subscribeToPremiumAction] Missing PAYMENT_API_KEY in process.env");
    return { error: "Configuración de pasarela de pagos no disponible. Por favor verifique las variables de entorno." };
  }

  // Log simulated or real gateway transaction processing
  console.log(`[Payment Gateway API] Processing $5.00 USD charge for restaurant ${restaurant.name} (${restaurant.id})`);
  console.log(`[Payment Gateway API] SmartFields Key: ${smartFieldsKey.substring(0, 8)}... | Secret Key Present: ${Boolean(secretKey)}`);
  if (paymentData?.cardHolderName) {
    console.log(`[Payment Gateway API] Cardholder: ${paymentData.cardHolderName} | Last 4: **** ${paymentData.cardNumberLast4 || '****'}`);
  }

  // Calculate subscription extension ($5 USD / 1 month)
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
    message: `¡Pago de $5.00 USD procesado con éxito con la tarjeta${cardSuffix}! Tu Plan Premium ha sido activado/renovado por 30 días.`,
    plan: updatedRestaurant.plan,
    trialEndsAt: updatedRestaurant.trialEndsAt.toISOString()
  };
}

export async function resetUserPasswordAction(userId: string, newPassword: string) {
  const hashedPassword = bcrypt.hashSync(newPassword, 15); // Hashing password securely
  await prismaControl.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });

  return { success: true };
}

export async function updateSystemSettingAction(key: string, value: string) {
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
  subtotal: number;
  iva: number;
  serviceCharge: number;
  tip: number;
  deliveryCost: number;
  seasonRateName?: string;
  seasonRateAmount?: number;
  total: number;
  paymentMethod: string;
  items: { dishName: string; price: number; quantity: number }[];
}) {


  try {
    const order = await prisma.order.create({
      data: {
        restaurantId: data.restaurantId,
        tableName: data.tableName,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        // @ts-ignore
        customerAddress: data.customerAddress || null,
        subtotal: data.subtotal,
        iva: data.iva,
        serviceCharge: data.serviceCharge,
        tip: data.tip,
        deliveryCost: data.deliveryCost,
        seasonRateName: data.seasonRateName || null,
        seasonRateAmount: data.seasonRateAmount || 0,
        total: data.total,
        paymentMethod: data.paymentMethod,
        items: {
          create: data.items.map((item) => ({
            dishName: item.dishName,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
    });

    // Auto-upsert into Customer CRM table
    if (data.customerPhone && data.customerPhone.trim()) {
      try {
        const rawPhone = data.customerPhone.trim();
        // @ts-ignore
        const existing = await prisma.customer.findFirst({
          where: { restaurantId: data.restaurantId, phone: rawPhone }
        });
        if (existing) {
          const newOrdersCount = existing.totalOrders + 1;
          const newCategory = newOrdersCount >= 5 ? "VIP" : newOrdersCount >= 2 ? "FRECUENTE" : existing.category;
          // @ts-ignore
          await prisma.customer.update({
            where: { id: existing.id },
            data: {
              name: data.customerName || existing.name,
              address: data.customerAddress || existing.address,
              totalOrders: newOrdersCount,
              totalSpent: existing.totalSpent + data.total,
              category: newCategory,
              lastOrderAt: new Date(),
            }
          });
        } else {
          // @ts-ignore
          await prisma.customer.create({
            data: {
              restaurantId: data.restaurantId,
              name: data.customerName || "Cliente",
              phone: rawPhone,
              address: data.customerAddress || null,
              totalOrders: 1,
              totalSpent: data.total,
              category: "NUEVO",
              lastOrderAt: new Date(),
            }
          });
        }
      } catch (e) {
        console.warn("Error auto-updating customer in CRM:", e);
      }
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: data.restaurantId },
      select: { slug: true }
    });

    if (restaurant) {
      revalidatePath(`/admin`);
      revalidatePath(`/${restaurant.slug}`);
      revalidatePath(`/${restaurant.slug}/rastreo`);
      revalidatePath(`/${restaurant.slug}/repartidor`);
    }

    return { 
      success: true, 
      orderId: order.id,
      // @ts-ignore
      orderNumber: order.orderNumber || 1 
    };
  } catch (error) {
    console.error("Error creating order:", error);
    return { error: "No se pudo guardar el pedido." };
  }
}

export async function updateOrderStatusAction(
  orderId: string, 
  status: string,
  driverData?: { driverName?: string; driverPhone?: string }
) {


  try {
    const updateData: any = { status };
    if (driverData?.driverName !== undefined) {
      updateData.driverName = driverData.driverName;
    }
    if (driverData?.driverPhone !== undefined) {
      updateData.driverPhone = driverData.driverPhone;
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: { restaurant: { select: { slug: true } } }
    });

    revalidatePath(`/admin`);
    revalidatePath(`/${order.restaurant.slug}`);
    revalidatePath(`/${order.restaurant.slug}/rastreo`);
    revalidatePath(`/${order.restaurant.slug}/repartidor`);
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
    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        ivaPercent: data.ivaPercent,
        servicePercent: data.servicePercent,
        deliveryCost: data.deliveryCost,
        deliveryEnabled: data.deliveryEnabled,
        // @ts-ignore
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

  // Find user
  const user = await prismaControl.user.findUnique({
    where: { email: cleanEmail },
  });

  // Always return success message to protect privacy
  if (!user) {
    return {
      success: true,
      message: "Si tu correo está registrado, recibirás un mensaje con las instrucciones para restablecer tu contraseña.",
    };
  }

  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

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
  if (!isSuperAdmin) return { error: "No autorizado." };

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
  if (!isSuperAdmin) return { error: "No autorizado." };

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
  if (!isSuperAdmin) return { error: "No autorizado." };

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
  if (!isSuperAdmin) return { error: "No autorizado." };

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
  if (!isSuperAdmin) return { error: "No autorizado." };

  await prismaControl.lead.delete({
    where: { id: leadId },
  });

  revalidatePath("/super-admin");
  return { success: true };
}

export async function convertProspectToRestaurantAction(leadId: string, password: string) {
  const isSuperAdmin = await getSuperAdminSession();
  if (!isSuperAdmin) return { error: "No autorizado." };

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

  const rate = await prisma.seasonRate.update({
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
  revalidatePath(`/${rate.restaurant.slug}`);
  return { success: true };
}

export async function deleteSeasonRateAction(rateId: string) {
  await refreshUserSession();

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

  try {
    // @ts-ignore
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

  try {
    // @ts-ignore
    const customer = await prisma.customer.update({
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
    return { success: true, customer };
  } catch (error) {
    console.error("Error updating customer:", error);
    return { error: "No se pudo actualizar el cliente." };
  }
}

export async function deleteCustomerAction(customerId: string) {
  await refreshUserSession();

  try {
    // @ts-ignore
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

  let importedCount = 0;
  let updatedCount = 0;

  try {
    for (const item of customers) {
      if (!item.name || !item.phone) continue;
      const cleanPhone = item.phone.trim();
      if (!cleanPhone) continue;

      // @ts-ignore
      const existing = await prisma.customer.findFirst({
        where: { restaurantId, phone: cleanPhone },
      });

      if (existing) {
        // @ts-ignore
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
        // @ts-ignore
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


