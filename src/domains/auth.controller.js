import jwt from "jsonwebtoken";
import db, { hashPassword } from "../config/db.js";
import { JWT_SECRET } from "../config/env.config.js";

export const login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      status: "error",
      message: "Por favor, ingrese usuario y contraseña.",
    });
  }

  // Buscar al usuario en SQLite
  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    (err, user) => {
      if (err) {
        console.error("Error al buscar usuario en SQLite:", err);
        return res.status(500).json({
          status: "error",
          message: "Error interno del servidor.",
        });
      }

      if (!user) {
        return res.status(401).json({
          status: "error",
          message: "Usuario o contraseña incorrectos.",
        });
      }

      // Validar la contraseña cifrada
      const hashed = hashPassword(password);
      if (user.password !== hashed) {
        return res.status(401).json({
          status: "error",
          message: "Usuario o contraseña incorrectos.",
        });
      }

      // Emitir el token JWT
      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.json({
        status: "success",
        token,
        username: user.username,
      });
    }
  );
};
