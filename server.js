import express from "express";
import cors from "cors"; // 1. Importar CORS
import apiRoutes from "./src/routes.js";
import { API_PORT } from "./src/config/env.config.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", apiRoutes);

app.listen(API_PORT, () => {
  console.log(`Escuchando en: http://localhost:${API_PORT}/api`);
});
