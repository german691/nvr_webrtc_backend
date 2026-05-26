import { Client } from "ssh2";

// Matriz en memoria para trackear qué nodos están transmitiendo y sus PIDs
export const activeStreams = new Map();

// Helper para ejecutar comandos SSH remotos usando Promesas
export function executeRemoteCommand(node, cmd) {
  return new Promise((resolve, reject) => {
    if (!node || !node.ip) {
      return reject(new Error("Objeto de nodo inválido"));
    }
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
      .connect({
        host: node.ip,
        port: parseInt(node.port, 10) || 22,
        username: node.username || "root",
        password: node.password || "tecno26",
        readyTimeout: 2000, // Timeout rápido de 2 segundos para evitar bloqueos si el nodo está apagado
      });
  });
}
