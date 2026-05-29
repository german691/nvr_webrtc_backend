import { WebSocketServer } from "ws";
import url from "url";

// Mapa de agentes activos en memoria: nodeIp -> { ws, cameras, lastSeen }
export const activeAgents = new Map();

// Set de conexiones de clientes frontend activos: Set(ws)
export const activeClients = new Set();

// Mapa para gestionar comandos pendientes con promesas: msgId -> { resolve, reject, timeout }
const pendingCommands = new Map();

// Helper para enviar comandos a un agente y esperar respuesta asíncrona por promesa
export function sendCommandToAgent(nodeIp, action, payload = {}) {
  return new Promise((resolve, reject) => {
    const agent = activeAgents.get(nodeIp);
    if (!agent || agent.ws.readyState !== 1) {
      return reject(new Error(`El agente de la Mini-PC (${nodeIp}) no está en línea.`));
    }

    const msgId = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    
    // Configurar tiempo de espera (timeout) de 10 segundos
    const timeout = setTimeout(() => {
      pendingCommands.delete(msgId);
      reject(new Error(`Tiempo de espera agotado al ejecutar '${action}' en el nodo ${nodeIp}.`));
    }, 10000);

    pendingCommands.set(msgId, { resolve, reject, timeout });

    agent.ws.send(JSON.stringify({ msgId, action, ...payload }));
  });
}

// Difundir un evento a todos los clientes frontend conectados en tiempo real
export function broadcastToClients(data) {
  const payload = JSON.stringify(data);
  activeClients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

// Inicializar el servidor WebSocket
export function initializeWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;

    if (pathname === "/ws/edge" || pathname === "/ws/client") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws, request) => {
    const pathname = url.parse(request.url).pathname;

    if (pathname === "/ws/client") {
      // Registrar cliente frontend
      activeClients.add(ws);
      console.log(`[WS] Frontend cliente conectado. Total: ${activeClients.size}`);

      // Enviarle el estado inicial de todos los agentes
      const statusPayload = {};
      for (const [ip] of activeAgents.entries()) {
        statusPayload[ip] = "online";
      }
      ws.send(JSON.stringify({ type: "initial_status", status: statusPayload }));

      ws.on("close", () => {
        activeClients.delete(ws);
        console.log(`[WS] Frontend cliente desconectado. Total: ${activeClients.size}`);
      });
    }

    if (pathname === "/ws/edge") {
      // Gestión de Agente de Mini-PC
      let nodeIp = null;

      ws.on("message", async (message) => {
        try {
          const data = JSON.parse(message.toString());

          // 1. Registro inicial del agente
          if (data.action === "register") {
            nodeIp = data.nodeIp;
            activeAgents.set(nodeIp, {
              ws,
              cameras: data.cameras || [],
              lastSeen: Date.now()
            });
            console.log(`[WS] Mini-PC Agente registrado: ${nodeIp}`);
            
            // Avisar a todos los frontends que el nodo está online en tiempo real
            broadcastToClients({ type: "node_status", nodeIp, status: "online" });
            return;
          }

          // 2. Respuesta a un comando enviado previamente
          if (data.msgId && pendingCommands.has(data.msgId)) {
            const { resolve, reject, timeout } = pendingCommands.get(data.msgId);
            clearTimeout(timeout);
            pendingCommands.delete(data.msgId);

            if (data.status === "success") {
              resolve(data.data);
            } else {
              reject(new Error(data.error || "Fallo en el Agente"));
            }
            return;
          }

          // 3. Evento push espontáneo enviado por el agente (ej: cámara desconectada por USB)
          if (data.event) {
            console.log(`[WS Event] Recibido desde ${nodeIp}: ${data.event} - Dev: ${data.dev}`);
            broadcastToClients({
              type: "agent_event",
              nodeIp,
              event: data.event,
              dev: data.dev
            });
            return;
          }

        } catch (err) {
          console.error("[WS] Error parseando mensaje de agente:", err.message);
        }
      });

      // Heartbeat periódico (Ping/Pong)
      const heartbeatInterval = setInterval(() => {
        if (ws.readyState === 1) {
          ws.ping();
        }
      }, 5000);

      ws.on("close", () => {
        clearInterval(heartbeatInterval);
        if (nodeIp) {
          activeAgents.delete(nodeIp);
          console.log(`[WS] Mini-PC Agente desconectado: ${nodeIp}`);
          // Broadcast de desconexión inmediata al frontend
          broadcastToClients({ type: "node_status", nodeIp, status: "offline" });
        }
      });

      ws.on("error", (err) => {
        console.error(`[WS Error] Agente ${nodeIp || "desconocido"}:`, err.message);
      });
    }
  });

  console.log("=== SERVIDOR WEBSOCKET INICIALIZADO Y CONFIGURADO ===");
}
