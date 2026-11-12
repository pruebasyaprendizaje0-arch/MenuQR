const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server: ServerIO } = require("socket.io");

process.on("uncaughtException", (err) => {
  console.error("[Uncaught Exception in server.js]:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection in server.js]:", reason);
});

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("[HTTP Server Error]:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Inicializar Socket.IO sobre el servidor HTTP compartido
  const io = new ServerIO(httpServer, {
    path: "/api/socket",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // Asignar inmediatamente a globalThis y global antes de recibir peticiones
  globalThis.io = io;
  globalThis.ioServer = io;
  global.io = io;
  global.ioServer = io;

  io.on("connection", (socket) => {
    const qNegocioId = socket.handshake.query?.negocio_id;
    if (qNegocioId && typeof qNegocioId === "string") {
      const room = `negocio_${qNegocioId}`;
      socket.join(room);
      console.log(`[Socket.IO] Socket ${socket.id} se unió automáticamente a la sala ${room}`);
    }

    socket.on("join_negocio", (negocio_id) => {
      if (negocio_id) {
        const room = `negocio_${negocio_id}`;
        socket.join(room);
        console.log(`[Socket.IO] Socket ${socket.id} se unió a la sala ${room}`);
      }
    });

    socket.on("leave_negocio", (negocio_id) => {
      if (negocio_id) {
        const room = `negocio_${negocio_id}`;
        socket.leave(room);
        console.log(`[Socket.IO] Socket ${socket.id} abandonó la sala ${room}`);
      }
    });

    socket.on("producto_actualizado", (data) => {
      if (data?.negocio_id) {
        socket.to(`negocio_${data.negocio_id}`).emit("producto_actualizado", data);
      }
    });

    socket.on("stock_actualizado", (data) => {
      if (data?.negocio_id) {
        socket.to(`negocio_${data.negocio_id}`).emit("stock_actualizado", data);
      }
    });

    socket.on("item_cancelado", (data) => {
      if (data?.negocio_id) {
        socket.to(`negocio_${data.negocio_id}`).emit("item_cancelado", data);
      }
    });

    socket.on("pedido_cancelado", (data) => {
      if (data?.negocio_id) {
        socket.to(`negocio_${data.negocio_id}`).emit("pedido_cancelado", data);
      }
    });

    socket.on("disconnect", () => {
      // Desconexión limpia
    });
  });

  httpServer.once("error", (err) => {
    console.error("[HTTP Server Fatal Error]:", err);
    process.exit(1);
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> [MenuQR Pro] Servidor listo en http://${hostname}:${port} (Socket.IO activo en /api/socket)`);
  });
}).catch((err) => {
  console.error("[Server Prepare Error]:", err);
  process.exit(1);
});

