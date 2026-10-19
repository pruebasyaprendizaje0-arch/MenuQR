import { NextRequest, NextResponse } from "next/server";
import { pool, ensureDbTables } from "@/lib/db-pool";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

// GET /api/reservas/cabanas?negocio_id=...
export async function GET(req: NextRequest) {
  try {
    await ensureDbTables();
    const { searchParams } = new URL(req.url);
    const negocioId = searchParams.get("negocio_id");

    if (!negocioId) {
      return NextResponse.json({ ok: false, error: "negocio_id es requerido" }, { status: 400 });
    }

    const { rows } = await pool.query(
      `SELECT d.id, d.name, d.description, d.price, d."imageUrl", d."isAvailable", d.variants, c.name as "categoryName"
       FROM "Dish" d
       LEFT JOIN "Category" c ON d."categoryId" = c.id
       WHERE d."restaurantId" = $1
       ORDER BY c."order" ASC, d."name" ASC`,
      [negocioId]
    );

    const cabanas = rows.map((dish) => {
      let beds: string | null = null;
      let maxGuests: number | null = null;

      if (dish.variants) {
        try {
          const parsed = typeof dish.variants === "string" ? JSON.parse(dish.variants) : dish.variants;
          if (parsed && typeof parsed === "object") {
            if (parsed.beds && String(parsed.beds).trim() !== "") {
              beds = String(parsed.beds).trim();
            }
            if (parsed.maxGuests !== undefined && parsed.maxGuests !== null && Number(parsed.maxGuests) > 0) {
              maxGuests = Number(parsed.maxGuests);
            }
          }
        } catch {}
      }

      return {
        id: dish.id,
        name: dish.name,
        description: dish.description || "",
        price: Number(dish.price),
        imageUrl: dish.imageUrl || null,
        isAvailable: Boolean(dish.isAvailable),
        categoryName: dish.categoryName || "Alojamientos",
        beds,
        maxGuests,
      };
    });

    return NextResponse.json({ ok: true, cabanas });
  } catch (err: any) {
    console.error("[GET /api/reservas/cabanas] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al obtener cabañas" },
      { status: 500 }
    );
  }
}

// PATCH /api/reservas/cabanas - Editar cama, huéspedes, precio o nombre de cabaña
export async function PATCH(req: NextRequest) {
  try {
    await ensureDbTables();
    const body = await req.json();
    const { dish_id, beds, maxGuests, price, name, description, isAvailable } = body;

    if (!dish_id) {
      return NextResponse.json({ ok: false, error: "dish_id es requerido" }, { status: 400 });
    }

    // Obtener plato actual y sus variantes
    const { rows } = await pool.query(
      `SELECT id, "restaurantId", variants, price, name, description, "isAvailable"
       FROM "Dish" WHERE id = $1 LIMIT 1`,
      [dish_id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Alojamiento no encontrado" }, { status: 404 });
    }

    const currentDish = rows[0];
    let variantsObj: any = {};
    if (currentDish.variants) {
      try {
        variantsObj = typeof currentDish.variants === "string" ? JSON.parse(currentDish.variants) : currentDish.variants;
        if (!variantsObj || typeof variantsObj !== "object") variantsObj = {};
      } catch {}
    }

    // Actualizar camas
    if (beds !== undefined) {
      if (typeof beds === "string" && beds.trim() !== "") {
        variantsObj.beds = beds.trim();
      } else {
        delete variantsObj.beds;
      }
    }

    // Actualizar huéspedes
    if (maxGuests !== undefined) {
      const numGuests = Number(maxGuests);
      if (numGuests > 0) {
        variantsObj.maxGuests = numGuests;
      } else {
        delete variantsObj.maxGuests;
      }
    }

    const newVariantsJson = Object.keys(variantsObj).length > 0 ? JSON.stringify(variantsObj) : null;
    const newPrice = price !== undefined ? Number(price) : currentDish.price;
    const newName = name !== undefined && String(name).trim() !== "" ? String(name).trim() : currentDish.name;
    const newDesc = description !== undefined ? description : currentDish.description;
    const newAvail = isAvailable !== undefined ? Boolean(isAvailable) : currentDish.isAvailable;

    await pool.query(
      `UPDATE "Dish"
       SET variants = $1, price = $2, name = $3, description = $4, "isAvailable" = $5, "updatedAt" = NOW()
       WHERE id = $6`,
      [newVariantsJson, newPrice, newName, newDesc, newAvail, dish_id]
    );

    // Obtener slug del negocio para revalidar
    const { rows: restRows } = await pool.query(
      `SELECT slug FROM "Restaurant" WHERE id = $1 LIMIT 1`,
      [currentDish.restaurantId]
    );
    if (restRows.length > 0 && restRows[0].slug) {
      revalidatePath(`/reservas/${restRows[0].slug}`);
      revalidatePath(`/${restRows[0].slug}`);
    }
    revalidatePath("/admin");

    return NextResponse.json({
      ok: true,
      message: "Alojamiento actualizado correctamente",
      dish: {
        id: dish_id,
        name: newName,
        price: newPrice,
        beds: variantsObj.beds || null,
        maxGuests: variantsObj.maxGuests || null,
      },
    });
  } catch (err: any) {
    console.error("[PATCH /api/reservas/cabanas] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error al actualizar alojamiento" },
      { status: 500 }
    );
  }
}
