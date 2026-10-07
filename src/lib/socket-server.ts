import type { Server as ServerIO } from "socket.io";

const globalForSocket = globalThis as unknown as {
  ioServer?: ServerIO;
};

export function setIO(io: ServerIO): void {
  globalForSocket.ioServer = io;
}

export function getIO(): ServerIO | null {
  return globalForSocket.ioServer ?? null;
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
