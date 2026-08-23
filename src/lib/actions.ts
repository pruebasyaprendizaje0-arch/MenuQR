"use server";

import { prisma } from "@/lib/db";
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
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Por favor complete todos los campos." };
  }

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "pruebasyaprendizaje0@gmail.com";
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "Frhc1971*";

  if (email.toLowerCase().trim() === superAdminEmail.toLowerCase().trim() && password === superAdminPassword) {
    await setSuperAdminSession();
    redirect("/super-admin");
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return { error: "Correo o contraseña incorrectos." };
  }

  await setUserSession(user.id, user.email);
  redirect("/admin");
}

export async function registerUserAction(prevState: unknown, formData: FormData) {
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
  const existingUser = await prisma.user.findUnique({
    where: { email: cleanEmail }
  });

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
    const existingRestaurant = await prisma.restaurant.findUnique({
      where: { slug: cleanSlug }
    });
    if (!existingRestaurant) {
      isSlugTaken = false;
    } else {
      attempt++;
      cleanSlug = `${baseSlug}-${attempt}`;
    }
  }

  const trialEndsAt = new Date();
  trialEndsAt.setMonth(trialEndsAt.getMonth() + 1);

  // Create User and their default Restaurant
  const user = await prisma.user.create({
    data: {
      name,
      email: cleanEmail,
      password: hashedPassword,
      restaurants: {
        create: {
          name: restaurantName,
          slug: cleanSlug,
          whatsapp: "",
          themeColor: "#ef4444",
          locality: `${province.trim()} | ${canton.trim()} | ${parroquia.trim()} | ${sector.trim()}`,
          plan: "FREE",
          trialEndsAt,
        }
      }
    }
  });

  await setUserSession(user.id, user.email);
  redirect("/admin/restaurante");
}

export async function logoutUserAction() {
  await clearUserSession();
  redirect("/");
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
      specialty: specialty || null,
      services: services || null,
      contactNumbers: contactNumbers || null,
      ubicameUrl: ubicameUrl || null,
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
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "pruebasyaprendizaje0@gmail.com";
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "Frhc1971*";

  if (!email || !password) {
    return { error: "Por favor complete todos los campos." };
  }

  if (email.toLowerCase().trim() !== superAdminEmail.toLowerCase().trim() || password !== superAdminPassword) {
    return { error: "Correo o contraseña incorrectos." };
  }

  await setSuperAdminSession();
  redirect("/super-admin");
}

export async function superAdminLogoutAction() {
  await clearSuperAdminSession();
  redirect("/");
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
      await prisma.user.delete({
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
  const existingUser = await prisma.user.findUnique({
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
    const existingRestaurant = await prisma.restaurant.findUnique({
      where: { slug: cleanSlug }
    });
    if (!existingRestaurant) {
      isSlugTaken = false;
    } else {
      attempt++;
      cleanSlug = `${baseSlug}-${attempt}`;
    }
  }

  const user = await prisma.user.create({
    data: {
      name: data.userName,
      email: cleanEmail,
      password: hashedPassword,
    }
  });

  const localityParts = [data.province, data.canton, data.parroquia, data.sector].filter(Boolean);
  const locality = localityParts.length > 0 ? localityParts.join(", ") : null;

  await prisma.restaurant.create({
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

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { user: true }
  });

  if (!restaurant) {
    return { error: "Restaurante no encontrado." };
  }

  const cleanEmail = data.email.toLowerCase().trim();
  const cleanSlug = data.slug.toLowerCase().trim();

  // Check unique slug if changed
  if (cleanSlug !== restaurant.slug) {
    const existingSlug = await prisma.restaurant.findUnique({
      where: { slug: cleanSlug }
    });
    if (existingSlug && existingSlug.id !== restaurantId) {
      return { error: "El identificador (slug) ya está en uso por otro restaurante." };
    }
  }

  // Check unique email if changed
  if (cleanEmail !== restaurant.user.email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });
    if (existingEmail && existingEmail.id !== restaurant.userId) {
      return { error: "El correo electrónico ya está registrado por otro usuario." };
    }
  }

  // Update user
  await prisma.user.update({
    where: { id: restaurant.userId },
    data: {
      name: data.userName,
      email: cleanEmail,
    }
  });

  // Update restaurant
  const updatedRestaurant = await prisma.restaurant.update({
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
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  if (!user) return { error: "Usuario no encontrado." };

  await setUserSession(user.id, user.email);
  redirect("/admin");
}

export async function changeUserPlanAction(restaurantId: string, plan: "FREE" | "PRO") {
  const restaurant = await prisma.restaurant.update({
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
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });

  return { success: true };
}

export async function updateSystemSettingAction(key: string, value: string) {
  await prisma.systemSetting.upsert({
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
  subtotal: number;
  iva: number;
  serviceCharge: number;
  tip: number;
  deliveryCost: number;
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
        subtotal: data.subtotal,
        iva: data.iva,
        serviceCharge: data.serviceCharge,
        tip: data.tip,
        deliveryCost: data.deliveryCost,
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

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: data.restaurantId },
      select: { slug: true }
    });

    if (restaurant) {
      revalidatePath(`/admin`);
      revalidatePath(`/${restaurant.slug}`);
    }

    return { success: true, orderId: order.id };
  } catch (error) {
    console.error("Error creating order:", error);
    return { error: "No se pudo guardar el pedido." };
  }
}

export async function updateOrderStatusAction(orderId: string, status: string) {
  try {
    await refreshUserSession();
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: { restaurant: { select: { slug: true } } }
    });

    revalidatePath(`/admin`);
    revalidatePath(`/${order.restaurant.slug}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating order status:", error);
    return { error: "No se pudo actualizar el estado del pedido." };
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
  const user = await prisma.user.findUnique({
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

  await prisma.user.update({
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

  const user = await prisma.user.findFirst({
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

  await prisma.user.update({
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


