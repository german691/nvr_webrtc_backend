import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.config.js";

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      status: "error",
      message: "Acceso no autorizado. Token ausente.",
    });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      status: "error",
      message: "Acceso no autorizado. Formato de token inválido.",
    });
  }

  const token = parts[1];

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        status: "error",
        message: "Acceso no autorizado. Token inválido o expirado.",
      });
    }

    // Inyectar los datos del usuario decodificados en la request
    req.user = decoded;
    next();
  });
};
