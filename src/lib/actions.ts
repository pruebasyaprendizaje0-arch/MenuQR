"use server";

import { prisma } from "@/lib/db";
import { setUserSession, clearUserSession, setSuperAdminSession, clearSuperAdminSession, refreshUserSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

// Helper to save files to public/uploads
async function saveUploadedFile(file: File | null): Promise<string | null> {
  if (!file || file.size === 0 || !file.name) {
    return null;
  }
  
  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
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
  const sector = (formData.get("sector") as string) || "";

  if (!name || !email || !password || !restaurantName || !province || !canton || !parroquia) {
    return { error: "Por favor complete todos los campos requeridos de ubicación." };
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
  const deleted = await prisma.restaurant.delete({
    where: { id: restaurantId }
  });

  revalidatePath("/super-admin");
  revalidatePath(`/${deleted.slug}`);
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


