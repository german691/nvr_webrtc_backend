import { Client } from "ssh2";
import { EDGE_CONFIG } from "../config/env.config.js";

// Matriz en memoria para trackear qué nodos están transmitiendo y sus PIDs
export const activeStreams = new Map();

// Helper para ejecutar comandos SSH remotos usando Promesas
export function executeRemoteCommand(cmd) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.exec(cmd, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          let data = "";
          stream.on("data", (chunk) => {
            data += chunk;
          });
          stream.on("close", () => {
            conn.end();
            resolve(data.trim());
          });
        });
      })
      .on("error", reject)
      .connect(EDGE_CONFIG);
  });
}
