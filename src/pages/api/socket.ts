import type { NextApiRequest, NextApiResponse } from "next";
import { Server as ServerIO } from "socket.io";
import type { Server as NetServer } from "http";
import type { Socket as NetSocket } from "net";
import { setIO } from "@/lib/socket-server";

export const config = {
  api: {
    bodyParser: false,
  },
};

interface SocketServer extends NetServer {
  io?: ServerIO;
}

interface SocketWithServer extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithServer;
}

export default function SocketHandler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  if (!res.socket?.server?.io) {
    console.log("[Socket.IO] Inicializando servidor Socket.IO...");
    const io = new ServerIO(res.socket.server as any, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    });

    io.on("connection", (socket) => {
      const qNegocioId = socket.handshake.query.negocio_id as string | undefined;
      if (qNegocioId) {
        const room = `negocio_${qNegocioId}`;
        socket.join(room);
        console.log(`[Socket.IO] Socket ${socket.id} se unió automáticamente a ${room}`);
      }

      socket.on("join_negocio", (negocio_id: string) => {
        if (negocio_id) {
          const room = `negocio_${negocio_id}`;
          socket.join(room);
          console.log(`[Socket.IO] Socket ${socket.id} se unió a ${room}`);
        }
      });

      socket.on("producto_actualizado", (data: any) => {
        if (data?.negocio_id) {
          socket.to(`negocio_${data.negocio_id}`).emit("producto_actualizado", data);
        }
      });

      socket.on("disconnect", () => {
        // Desconexión normal
      });
    });

    res.socket.server.io = io;
    setIO(io);
  } else {
    setIO(res.socket.server.io);
  }

  res.end();
}
