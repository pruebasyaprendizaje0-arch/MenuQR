import type { Server as ServerIO } from "socket.io";

const globalForSocket = globalThis as unknown as {
  ioServer?: ServerIO;
  io?: ServerIO;
};

export function setIO(io: ServerIO): void {
  globalForSocket.ioServer = io;
  globalForSocket.io = io;
  (globalThis as any).io = io;
  (globalThis as any).ioServer = io;
  if (typeof global !== "undefined") {
    (global as any).io = io;
    (global as any).ioServer = io;
  }
}

export function getIO(): ServerIO | null {
  return (
    globalForSocket.io ||
    globalForSocket.ioServer ||
    (globalThis as any).io ||
    (globalThis as any).ioServer ||
    (typeof global !== "undefined" && ((global as any).io || (global as any).ioServer)) ||
    null
  );
}

/**
 * Emite evento 'nuevo_pedido' a la sala del negocio
 */
export function emitNuevoPedido(negocio_id: string, pedido: any): void {
  const io = getIO();
  if (io) {
    const room = `negocio_${negocio_id}`;
    io.to(room).emit("nuevo_pedido", pedido);
    console.log(`[Socket.IO] 'nuevo_pedido' emitido a la sala ${room}:`, pedido?.id || pedido);
  } else {
    console.warn(`[Socket.IO] No hay instancia de io disponible para emitir 'nuevo_pedido'`);
  }
}

/**
 * Emite evento 'items_añadidos' a la sala del negocio
 */
export function emitItemsAñadidos(negocio_id: string, mesa: string, items: any[]): void {
  const io = getIO();
  if (io) {
    const room = `negocio_${negocio_id}`;
    io.to(room).emit("items_añadidos", { mesa, items });
    console.log(`[Socket.IO] 'items_añadidos' emitido a la sala ${room} (Mesa ${mesa}):`, items.length, "items");
  } else {
    console.warn(`[Socket.IO] No hay instancia de io disponible para emitir 'items_añadidos'`);
  }
}

/**
 * Emite evento 'producto_actualizado' a la sala del negocio
 */
export function emitProductoActualizado(negocio_id: string, producto: any): void {
  const io = getIO();
  if (io) {
    const room = `negocio_${negocio_id}`;
    io.to(room).emit("producto_actualizado", producto);
    console.log(`[Socket.IO] 'producto_actualizado' emitido a la sala ${room}:`, producto?.id || producto);
  } else {
    console.warn(`[Socket.IO] No hay instancia de io disponible para emitir 'producto_actualizado'`);
  }
}

/**
 * Emite evento 'stock_actualizado' a la sala del negocio
 */
export function emitStockActualizado(negocio_id: string, updatedDishes: any[]): void {
  const io = getIO();
  if (io) {
    const room = `negocio_${negocio_id}`;
    io.to(room).emit("stock_actualizado", { updatedDishes, timestamp: new Date().toISOString() });
    console.log(`[Socket.IO] 'stock_actualizado' emitido a la sala ${room}:`, updatedDishes?.length, "productos");
  } else {
    console.warn(`[Socket.IO] No hay instancia de io disponible para emitir 'stock_actualizado'`);
  }
}

/**
 * Emite evento 'pedido_actualizado' a la sala del negocio (cambios de estado: en_cocina, listo, por_pagar, pagado)
 */
export function emitPedidoActualizado(negocio_id: string, pedido: any): void {
  const io = getIO();
  if (io) {
    const room = `negocio_${negocio_id}`;
    io.to(room).emit("pedido_actualizado", pedido);
    console.log(`[Socket.IO] 'pedido_actualizado' emitido a la sala ${room}:`, pedido?.id, "->", pedido?.estado);
  } else {
    console.warn(`[Socket.IO] No hay instancia de io disponible para emitir 'pedido_actualizado'`);
  }
}

/**
 * Emite evento 'item_cancelado' a la sala del negocio
 */
export function emitItemCancelado(
  negocio_id: string,
  data: {
    pedido_id: string;
    mesa: string;
    plato_nombre: string;
    motivo: string;
    cancelado_por: "cocina" | "mesero";
  }
): void {
  const io = getIO();
  if (io) {
    const room = `negocio_${negocio_id}`;
    io.to(room).emit("item_cancelado", data);
    console.log(`[Socket.IO] 'item_cancelado' emitido a la sala ${room}:`, data);
  } else {
    console.warn(`[Socket.IO] No hay instancia de io disponible para emitir 'item_cancelado'`);
  }
}

/**
 * Emite evento 'pedido_cancelado' a la sala del negocio
 */
export function emitPedidoCancelado(
  negocio_id: string,
  data: {
    pedido_id: string;
    mesa: string;
    motivo: string;
    cancelado_por: "cocina" | "mesero";
  }
): void {
  const io = getIO();
  if (io) {
    const room = `negocio_${negocio_id}`;
    io.to(room).emit("pedido_cancelado", data);
    console.log(`[Socket.IO] 'pedido_cancelado' emitido a la sala ${room}:`, data);
  } else {
    console.warn(`[Socket.IO] No hay instancia de io disponible para emitir 'pedido_cancelado'`);
  }
}

/**
 * Emite evento 'nueva_cita' a la sala del negocio (Vertical Citas & Turnos)
 */
export function emitNuevaCita(negocio_id: string, cita: any): void {
  const io = getIO();
  if (io) {
    const room = `negocio_${negocio_id}`;
    io.to(room).emit("nueva_cita", cita);
    console.log(`[Socket.IO] 'nueva_cita' emitido a la sala ${room}:`, cita?.id || cita);
  } else {
    console.warn(`[Socket.IO] No hay instancia de io disponible para emitir 'nueva_cita'`);
  }
}

/**
 * Emite evento 'cita_actualizada' a la sala del negocio (cambios de estado o cobro en caja)
 */
export function emitCitaActualizada(negocio_id: string, cita: any): void {
  const io = getIO();
  if (io) {
    const room = `negocio_${negocio_id}`;
    io.to(room).emit("cita_actualizada", cita);
    console.log(`[Socket.IO] 'cita_actualizada' emitido a la sala ${room}:`, cita?.id || cita);
  } else {
    console.warn(`[Socket.IO] No hay instancia de io disponible para emitir 'cita_actualizada'`);
  }
}

/**
 * Emite evento 'nueva_reserva' a la sala del negocio (Vertical Reservas & Hospedaje)
 */
export function emitNuevaReserva(negocio_id: string, reserva: any): void {
  const io = getIO();
  if (io) {
    const room = `negocio_${negocio_id}`;
    io.to(room).emit("nueva_reserva", reserva);
    console.log(`[Socket.IO] 'nueva_reserva' emitido a la sala ${room}:`, reserva?.id || reserva);
  } else {
    console.warn(`[Socket.IO] No hay instancia de io disponible para emitir 'nueva_reserva'`);
  }
}

/**
 * Emite evento 'reserva_actualizada' a la sala del negocio (check-in, check-out o cobro en caja)
 */
export function emitReservaActualizada(negocio_id: string, reserva: any): void {
  const io = getIO();
  if (io) {
    const room = `negocio_${negocio_id}`;
    io.to(room).emit("reserva_actualizada", reserva);
    console.log(`[Socket.IO] 'reserva_actualizada' emitido a la sala ${room}:`, reserva?.id || reserva);
  } else {
    console.warn(`[Socket.IO] No hay instancia de io disponible para emitir 'reserva_actualizada'`);
  }
}
