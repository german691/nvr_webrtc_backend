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

    // Si el usuario tiene pendiente cambiar la contraseña, bloquear peticiones a endpoints normales
    if (decoded.needsPasswordChange) {
      return res.status(403).json({
        status: "error",
        message: "Acceso denegado. Debe cambiar su contraseña obligatoriamente antes de continuar.",
      });
    }

    req.user = decoded;
    next();
  });
};

// Middleware específico para el cambio de contraseña (permite tokens con needsPasswordChange: true)
export const changePasswordMiddleware = (req, res, next) => {
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

    req.user = decoded;
    next();
  });
};

export const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      status: "error",
      message: "Acceso denegado. Se requieren privilegios de administrador para realizar esta operación.",
    });
  }
  next();
};
