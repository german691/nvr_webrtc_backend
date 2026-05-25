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

      const hashed = hashPassword(password);
      if (user.password !== hashed) {
        return res.status(401).json({
          status: "error",
          message: "Usuario o contraseña incorrectos.",
        });
      }

      const needsPasswordChange = user.password_changed === 0;

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, needsPasswordChange },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.json({
        status: "success",
        token,
        username: user.username,
        role: user.role,
        needsPasswordChange,
      });
    }
  );
};

export const changePassword = (req, res) => {
  const { newPassword } = req.body;
  const userId = req.user.id;

  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({
      status: "error",
      message: "La contraseña debe tener al menos 6 caracteres.",
    });
  }

  const hashedPassword = hashPassword(newPassword);

  db.run(
    "UPDATE users SET password = ?, password_changed = 1 WHERE id = ?",
    [hashedPassword, userId],
    function (err) {
      if (err) {
        console.error("Error al actualizar la contraseña en SQLite:", err);
        return res.status(500).json({
          status: "error",
          message: "Error interno al cambiar la contraseña.",
        });
      }

      const token = jwt.sign(
        { id: userId, username: req.user.username, role: req.user.role, needsPasswordChange: false },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.json({
        status: "success",
        message: "Contraseña actualizada exitosamente.",
        token,
      });
    }
  );
};

export const getUsers = (req, res) => {
  db.all("SELECT id, username, role, password_changed FROM users", [], (err, rows) => {
    if (err) {
      console.error("Error al obtener usuarios en SQLite:", err);
      return res.status(500).json({
        status: "error",
        message: "Error interno del servidor al obtener la lista de usuarios.",
      });
    }
    return res.json({
      status: "success",
      users: rows,
    });
  });
};

export const createUser = (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({
      status: "error",
      message: "Por favor, complete todos los campos obligatorios.",
    });
  }

  if (password.trim().length < 6) {
    return res.status(400).json({
      status: "error",
      message: "La contraseña debe tener al menos 6 caracteres.",
    });
  }

  if (role !== "admin" && role !== "viewer") {
    return res.status(400).json({
      status: "error",
      message: "Rol de usuario inválido. Use 'admin' o 'viewer'.",
    });
  }

  const hashedPassword = hashPassword(password);

  db.run(
    "INSERT INTO users (username, password, role, password_changed) VALUES (?, ?, ?, 0)",
    [username.trim(), hashedPassword, role],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) {
          return res.status(400).json({
            status: "error",
            message: "El nombre de usuario ingresado ya se encuentra registrado.",
          });
        }
        console.error("Error al registrar usuario en SQLite:", err);
        return res.status(500).json({
          status: "error",
          message: "Error interno del servidor al intentar crear el usuario.",
        });
      }

      return res.json({
        status: "success",
        message: "Usuario creado exitosamente.",
        user: {
          id: this.lastID,
          username: username.trim(),
          role,
          password_changed: 0,
        },
      });
    }
  );
};

export const updateUser = (req, res) => {
  const { id } = req.params;
  const { username, role } = req.body;

  if (!username || !role) {
    return res.status(400).json({
      status: "error",
      message: "Por favor, complete todos los campos obligatorios.",
    });
  }

  if (role !== "admin" && role !== "viewer") {
    return res.status(400).json({
      status: "error",
      message: "Rol de usuario inválido. Use 'admin' o 'viewer'.",
    });
  }

  // Protección: Evitar que el administrador actual se revoque sus propios permisos
  if (parseInt(id, 10) === req.user.id && role !== "admin") {
    return res.status(400).json({
      status: "error",
      message: "Operación inválida. No puede revocar sus propios permisos de administrador.",
    });
  }

  db.run(
    "UPDATE users SET username = ?, role = ? WHERE id = ?",
    [username.trim(), role, id],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) {
          return res.status(400).json({
            status: "error",
            message: "El nombre de usuario ya se encuentra en uso por otra cuenta.",
          });
        }
        console.error("Error al actualizar usuario en SQLite:", err);
        return res.status(500).json({
          status: "error",
          message: "Error interno al intentar actualizar el usuario.",
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          status: "error",
          message: "Usuario no encontrado.",
        });
      }

      return res.json({
        status: "success",
        message: "Usuario actualizado correctamente.",
      });
    }
  );
};

export const changeUserPasswordByAdmin = (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.trim().length < 6) {
    return res.status(400).json({
      status: "error",
      message: "La contraseña debe tener al menos 6 caracteres.",
    });
  }

  const hashedPassword = hashPassword(password);
  
  // Si un administrador cambia su propia clave, se marca de inmediato como cambiada (password_changed = 1).
  // Si cambia la clave de otro usuario, se marca como pendiente (password_changed = 0) para forzar el cambio en su primer inicio.
  const isSelf = parseInt(id, 10) === req.user.id;
  const passwordChangedVal = isSelf ? 1 : 0;

  db.run(
    "UPDATE users SET password = ?, password_changed = ? WHERE id = ?",
    [hashedPassword, passwordChangedVal, id],
    function (err) {
      if (err) {
        console.error("Error al actualizar clave de usuario en SQLite:", err);
        return res.status(500).json({
          status: "error",
          message: "Error interno al restablecer la contraseña.",
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          status: "error",
          message: "Usuario no encontrado.",
        });
      }

      return res.json({
        status: "success",
        message: isSelf
          ? "Contraseña actualizada exitosamente."
          : "Contraseña restablecida exitosamente. Se exigirá el cambio al usuario en su próximo inicio de sesión.",
      });
    }
  );
};

export const deleteUser = (req, res) => {
  const { id } = req.params;

  // Protección: Evitar la auto-eliminación
  if (parseInt(id, 10) === req.user.id) {
    return res.status(400).json({
      status: "error",
      message: "Operación inválida. No puede eliminar su propia cuenta de administrador.",
    });
  }

  db.run(
    "DELETE FROM users WHERE id = ?",
    [id],
    function (err) {
      if (err) {
        console.error("Error al eliminar usuario en SQLite:", err);
        return res.status(500).json({
          status: "error",
          message: "Error interno al eliminar el usuario.",
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          status: "error",
          message: "Usuario no encontrado.",
        });
      }

      return res.json({
        status: "success",
        message: "Usuario eliminado exitosamente.",
      });
    }
  );
};
