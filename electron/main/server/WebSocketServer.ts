// import http
import { app } from "electron";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import printer from "@thiagoelg/node-printer";
import { printByteArray } from "./printing/printutils";
import { IPrinter } from "./printing/IPrinter";

export class WebSocketServer {
  // @ts-ignore
  io: Server;

  init() {
    this.io = new Server(createServer());

    this.setupListeners();

    this.io.listen(3030, {
      cors: {
        origin: [
          "http://localhost:3000",
          "http://192.168.50.186:3000",
          "http://127.0.0.1:3000",
          "https://queresto.com",
          "https://www.queresto.com",
          "https://amritb.github.io",
        ],
        credentials: true,
      },
      serveClient: false,
      allowEIO3: true, // Fixes 'unsupported protocol version' error
    });
    console.log("WebSocketServer is running on http://localhost:3030");
  }

  private setupListeners() {
    this.io.on("connection", this.onConnection.bind(this));
  }

  private onConnection(socket: Socket) {
    console.log("a user connected", socket);

    socket.emit("info", { version: app.getVersion() });

    socket.on("printers", () => {
      const printers = printer.getPrinters();

      console.log(printers);

      socket.emit("printers", printers);
    });

    socket.on("printv2", async (data) => {
      const buf = data as Buffer;

      console.log("printv2");

      // Extract printer name from buffer
      let printerNameEnd = 0;
      while (buf[printerNameEnd] !== 0) {
        printerNameEnd++;
      }

      // Decode UTF-8 printer name
      const printerName = new TextDecoder().decode(
        buf.slice(0, printerNameEnd)
      );

      // Skip past the null terminator
      let i = printerNameEnd + 1;

      // Extract reqId from buffer
      const reqId = buf.readUInt32LE(i);
      i += 4;

      // Extract print data from buffer
      const printData = buf.slice(i);

      console.log(printerName, reqId);

      try {
        await printByteArray(printerName, printData);
      } catch (e) {
        console.error(e);
        throw e;
      }
    });
  }
}
