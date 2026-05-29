import express from "express";
import cors from "cors"; // 1. Importar CORS
import apiRoutes from "./src/routes.js";
import { API_PORT } from "./src/config/env.config.js";
import "./src/config/db.js"; // Inicializar SQLite y sembrar credenciales
import { initializeWebSocket } from "./src/config/websocket.js";
import { createServer } from "http";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", apiRoutes);

// Crear servidor HTTP integrado para Express y WebSockets
const server = createServer(app);

// Inicializar WebSockets
initializeWebSocket(server);

server.listen(API_PORT, () => {
  console.log(`Servidor NVR con WebSockets activo en http://localhost:${API_PORT}`);
});
