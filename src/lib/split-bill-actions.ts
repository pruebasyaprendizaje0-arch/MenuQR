"use server";

import { prisma } from "@/lib/db";
import { getSuperAdminSession, getUserSession, refreshUserSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type SelectedItem = { orderItemId: string; quantity: number };
type PaymentInput = { payerName?: string; paymentMethod: string; idempotencyKey?: string };
const cents = (n: number) => Math.round((n + Number.EPSILON) * 100);
const money = (n: number) => cents(n) / 100;
const ACTIVE = ["PENDING", "PREPARING", "IN_TRANSIT", "DELIVERED"];
const METHODS = ["cash", "efectivo", "qr", "deuna", "transferencia", "transfer", "tarjeta", "card"];

async function owner(id: string) {
  try {
    if (await getSuperAdminSession()) return { authorized: true };
    const user = await getUserSession();
    const restaurant = user?.userId && await prisma.restaurant.findUnique({ where: { id }, select: { userId: true } });
    return restaurant?.userId === user?.userId ? { authorized: true } : { authorized: false, error: "No tiene permisos para modificar este restaurante." };
  } catch (_) {
    return { authorized: false, error: "No tiene permisos para modificar este restaurante." };
  }
}
async function revalidate(id: string) {
  const r = await prisma.restaurant.findUnique({ where: { id }, select: { slug: true } });
  if (r) {
    try {
      revalidatePath(`/${r.slug}`);
      revalidatePath("/admin");
    } catch (_) {}
  }
}
async function session(id: string, restaurantId: string) {
  const value = await prisma.tableSession.findUnique({ where: { id }, include: { orders: { include: { order: { include: { items: true } } } } } });
  if (!value || value.restaurantId !== restaurantId) throw new Error("Sesión de mesa no encontrada.");
  return value;
}
function safe(value: any) {
  const paid = money(value.paidAmount);
  return { session: { id: value.id, status: value.status, totalAmount: money(value.totalAmount), paidAmount: paid },
    orders: value.orders.map((x: any) => ({ id: x.order.id, items: x.order.items.map((i: any) => ({ id: i.id, dishName: i.dishName, price: i.price, quantity: i.quantity })) })),
    payments: value.payments.map((p: any) => ({ id: p.id, payerName: p.payerName, amount: p.amount, paymentMethod: p.paymentMethod, status: p.status, createdAt: p.createdAt })),
    totalAmount: money(value.totalAmount), paidAmount: paid, pendingAmount: Math.max(0, money(value.totalAmount - paid)), status: value.status };
}

export async function createTableSessionAction(restaurantId: string, tableName: string) {
  try {
    const table = tableName?.trim();
    if (!restaurantId || !table || table === "Domicilio") return { error: "Mesa inválida." };

    const existing = await prisma.tableSession.findFirst({
      where: { restaurantId, tableName: table, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
      orderBy: { createdAt: "desc" },
      include: { payments: true, orders: { include: { order: { include: { items: true } } } } }
    });
    if (existing) return { success: true, session: existing };

    const last = await prisma.tableSession.findFirst({
      where: { restaurantId, tableName: table, status: { in: ["CLOSED", "PAID"] } },
      orderBy: { updatedAt: "desc" }
    });

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        tableName: table,
        status: { in: ACTIVE },
        ...(last ? { createdAt: { gt: last.updatedAt } } : {}),
        tableSessions: { none: {} }
      },
      include: { items: true }
    });

    if (!orders.length) return { error: "No hay pedidos activos para esta mesa." };

    const created = await prisma.tableSession.create({
      data: {
        restaurantId,
        tableName: table,
        totalAmount: money(orders.reduce((s, o) => s + o.total, 0)),
        orders: { create: orders.map(o => ({ orderId: o.id })) }
      },
      include: { payments: true, orders: { include: { order: { include: { items: true } } } } }
    });
    await revalidate(restaurantId);
    return { success: true, session: created };
  } catch (err: any) {
    console.error("createTableSessionAction error:", err);
    return { error: "No se pudo iniciar la cuenta de la mesa." };
  }
}

export async function getTableSessionAction(restaurantId: string, tableName: string): Promise<any> {
  try {
    const table = tableName?.trim();
    const value = await prisma.tableSession.findFirst({
      where: { restaurantId, tableName: table, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
      orderBy: { createdAt: "desc" },
      include: { payments: { orderBy: { createdAt: "asc" } }, orders: { include: { order: { include: { items: true } } } } }
    });

    if (value) return { success: true, ...safe(value) };

    const created = await createTableSessionAction(restaurantId, tableName);
    if (created.success && created.session) {
      return { success: true, ...safe(created.session) };
    }

    return { error: created.error || "Aún no hay una cuenta abierta para esta mesa." };
  } catch {
    return { error: "No se pudo consultar la cuenta." };
  }
}
export async function calculateEqualSplitAction(restaurantId: string, tableSessionId: string, people: number): Promise<any> {
  try { const s = await session(tableSessionId, restaurantId); if (!Number.isInteger(people) || people < 2 || people > 50) return { error: "El número de personas debe estar entre 2 y 50." }; const pending = cents(s.totalAmount) - cents(s.paidAmount); if (pending <= 0) return { error: "La cuenta ya está pagada." }; const base = Math.floor(pending / people), rem = pending % people, parts = Array.from({ length: people }, (_, i) => (base + (i < rem ? 1 : 0)) / 100); return { success: true, parts, amountPerPerson: parts[0], totalPending: pending / 100, exactSumMatches: true }; } catch (e: any) { return { error: e.message }; }
}
async function productCalc(restaurantId: string, tableSessionId: string, selections: SelectedItem[]) {
  const s = await session(tableSessionId, restaurantId); if (!selections?.length) throw new Error("Debes seleccionar al menos un producto.");
  const allocations = await prisma.tableSplitAllocation.findMany({ where: { tableSplitPayment: { tableSessionId, status: { in: ["PENDING", "COMPLETED"] } } }, select: { orderItemId: true, quantity: true } });
  const used = new Map<string, number>(); allocations.forEach(a => used.set(a.orderItemId, (used.get(a.orderItemId) || 0) + a.quantity));
  const lookup: Map<string, any> = new Map(s.orders.flatMap((x: any) => x.order.items.map((i: any) => [i.id, { i, o: x.order }] as [string, any])));
  let subtotal=0, discount=0, iva=0, serviceCharge=0, seasonRate=0, tip=0, total=0; const verifiedItems: any[]=[];
  for (const pick of selections) { const found = lookup.get(pick.orderItemId); if (!found || !Number.isInteger(pick.quantity) || pick.quantity < 1) throw new Error("Producto inválido."); if (pick.quantity > found.i.quantity - (used.get(pick.orderItemId) || 0)) throw new Error(`No quedan suficientes unidades de ${found.i.dishName}.`); const ratio=(found.i.price*pick.quantity)/(found.o.subtotal||1); const part={ subtotal:money(found.i.price*pick.quantity), discount:money(found.o.discountAmount*ratio), iva:money(found.o.iva*ratio), service:money(found.o.serviceCharge*ratio), seasonRate:money(found.o.seasonRateAmount*ratio), tip:money(found.o.tip*ratio), total:money(found.o.total*ratio) }; subtotal+=part.subtotal; discount+=part.discount; iva+=part.iva; serviceCharge+=part.service; seasonRate+=part.seasonRate; tip+=part.tip; total+=part.total; verifiedItems.push({ orderItemId:found.i.id, quantity:pick.quantity, ...part }); }
  total=money(total); if (cents(total)>cents(s.totalAmount)-cents(s.paidAmount)) throw new Error("La selección supera el saldo pendiente."); return { s, subtotal:money(subtotal), discount:money(discount), iva:money(iva), serviceCharge:money(serviceCharge), seasonRate:money(seasonRate), tip:money(tip), total, verifiedItems };
}
export async function calculateProductSplitAction(r: string, s: string, items: SelectedItem[]): Promise<any> { try { return { success:true, ...(await productCalc(r,s,items)) }; } catch(e:any) { return { error:e.message }; } }
async function pending(restaurantId:string, s:any, input:PaymentInput, amount:number, data:any) {
  const method=input.paymentMethod?.trim().toLowerCase(); if (!METHODS.includes(method)) throw new Error("Método de pago no válido."); const key=input.idempotencyKey?.trim(); if(key) { const old=await prisma.tableSplitPayment.findUnique({where:{idempotencyKey:key}}); if(old) return {success:true,payment:old,isDuplicate:true}; }
  const payment=await prisma.tableSplitPayment.create({data:{tableSessionId:s.id,payerName:input.payerName?.trim().slice(0,100)||"Comensal",amount:money(amount),paymentMethod:method,status:"PENDING",idempotencyKey:key||null,subtotalPart:data.subtotal,ivaPart:data.iva,servicePart:data.serviceCharge,allocations:data.verifiedItems?{create:data.verifiedItems.map((i:any)=>({orderItemId:i.orderItemId,quantity:i.quantity,subtotalPart:i.subtotal,discountPart:i.discount,ivaPart:i.iva,servicePart:i.service,seasonRatePart:i.seasonRate,tipPart:i.tip,totalPart:i.total}))}:undefined},include:{allocations:true}}); await revalidate(restaurantId); return {success:true,payment};
}
export async function requestProductSplitPaymentAction(r:string,s:string,items:SelectedItem[],input:PaymentInput): Promise<any> { try { const data=await productCalc(r,s,items); return await pending(r,data.s,input,data.total,data); } catch(e:any) { return {error:e.message||"No se pudo solicitar el pago."}; } }
export async function requestEqualSplitPaymentAction(r:string,s:string,people:number,input:PaymentInput): Promise<any> { const calc=await calculateEqualSplitAction(r,s,people); if(!calc.success)return calc; try{return await pending(r,await session(s,r),input,calc.amountPerPerson,{subtotal:calc.amountPerPerson,iva:0,serviceCharge:0});}catch(e:any){return{error:e.message};} }
export async function createSplitPaymentAction(..._args: any[]): Promise<any>{return{error:"El pago debe ser confirmado por el restaurante."};}
export async function confirmSplitPaymentAction(restaurantId:string,paymentId:string):Promise<any>{try{try{await refreshUserSession();}catch(_){}const a=await owner(restaurantId);if(!a.authorized)return{error:a.error};const result=await prisma.$transaction(async tx=>{const p=await tx.tableSplitPayment.findUnique({where:{id:paymentId},include:{tableSession:true}});if(!p||p.tableSession.restaurantId!==restaurantId||p.status!=="PENDING")throw new Error("Pago pendiente no encontrado.");if(cents(p.amount)>cents(p.tableSession.totalAmount)-cents(p.tableSession.paidAmount))throw new Error("El pago supera el saldo pendiente.");const paid=money(p.tableSession.paidAmount+p.amount);const session=await tx.tableSession.update({where:{id:p.tableSessionId},data:{paidAmount:paid,status:cents(paid)>=cents(p.tableSession.totalAmount)?"PAID":"PARTIALLY_PAID"}});const payment=await tx.tableSplitPayment.update({where:{id:p.id},data:{status:"COMPLETED",confirmedAt:new Date()}});return{payment,session};});await revalidate(restaurantId);return{success:true,...result};}catch(e:any){return{error:e.message||"No se pudo confirmar el pago."};}}
export async function rejectSplitPaymentAction(r:string,id:string):Promise<any>{try{try{await refreshUserSession();}catch(_){}const a=await owner(r);if(!a.authorized)return{error:a.error};const p=await prisma.tableSplitPayment.findUnique({where:{id},include:{tableSession:true}});if(!p||p.tableSession.restaurantId!==r||p.status!=="PENDING")return{error:"Pago pendiente no encontrado."};await prisma.tableSplitPayment.update({where:{id},data:{status:"FAILED"}});await revalidate(r);return{success:true};}catch{return{error:"No se pudo rechazar el pago."};}}
export async function registerManualSplitPaymentAction(r:string,s:string,d:{amount:number;paymentMethod:string;payerName?:string}):Promise<any>{try{await refreshUserSession();}catch(_){}const a=await owner(r);if(!a.authorized)return{error:a.error};try{const made=await pending(r,await session(s,r),d,d.amount,{subtotal:d.amount,iva:0,serviceCharge:0});return made.payment?await confirmSplitPaymentAction(r,made.payment.id):made;}catch(e:any){return{error:e.message};}}
export async function closeTableSessionAction(r:string,id:string){try{await refreshUserSession();}catch(_){}const a=await owner(r);if(!a.authorized)return{error:a.error};const s=await prisma.tableSession.findUnique({where:{id}});if(!s||s.restaurantId!==r)return{error:"Sesión de mesa no encontrada."};const session=await prisma.tableSession.update({where:{id},data:{status:"CLOSED"}});await revalidate(r);return{success:true,session};}
