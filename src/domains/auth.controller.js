import jwt from "jsonwebtoken";
import { hashPassword } from "../config/db.js";
import { JWT_SECRET } from "../config/env.config.js";
import { UserRepository } from "./user.repository.js";

/**
 * POST /api/auth/login
 * Maneja el inicio de sesión y devuelve un token JWT.
 */
export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      status: "error",
      message: "Por favor, ingrese usuario y contraseña.",
    });
  }

  try {
    const user = await UserRepository.findByUsername(username);

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
  } catch (err) {
    console.error("Error al buscar usuario en SQLite (login):", err);
    return res.status(500).json({
      status: "error",
      message: "Error interno del servidor.",
    });
  }
};

/**
 * POST /api/auth/change-password
 * Permite cambiar la contraseña obligatoria en el primer inicio de sesión.
 */
export const changePassword = async (req, res) => {
  const { newPassword } = req.body;
  const userId = req.user.id;

  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({
      status: "error",
      message: "La contraseña debe tener al menos 6 caracteres.",
    });
  }

  try {
    const hashedPassword = hashPassword(newPassword);
    const rowsAffected = await UserRepository.updatePassword(userId, hashedPassword, 1);

    if (rowsAffected === 0) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado.",
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
  } catch (err) {
    console.error("Error al cambiar contraseña obligatoria:", err);
    return res.status(500).json({
      status: "error",
      message: "Error interno al cambiar la contraseña.",
    });
  }
};

/**
 * GET /api/users
 * Devuelve la lista completa de usuarios registrados.
 */
export const getUsers = async (req, res) => {
  try {
    const users = await UserRepository.getAll();
    return res.json({
      status: "success",
      users,
    });
  } catch (err) {
    console.error("Error al obtener lista de usuarios:", err);
    return res.status(500).json({
      status: "error",
      message: "Error interno del servidor al obtener la lista de usuarios.",
    });
  }
};

/**
 * POST /api/users
 * Registra un nuevo usuario en la base de datos (Exclusivo Administrador).
 */
export const createUser = async (req, res) => {
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

  try {
    const hashedPassword = hashPassword(password);
    const newUser = await UserRepository.create(username, hashedPassword, role);

    return res.json({
      status: "success",
      message: "Usuario creado exitosamente.",
      user: newUser,
    });
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE")) {
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
};

/**
 * PUT /api/users/:id
 * Actualiza los datos generales de un usuario (Exclusivo Administrador).
 */
export const updateUser = async (req, res) => {
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

  // Protección: Evitar que el administrador actual se revoque sus propios privilegios
  if (parseInt(id, 10) === req.user.id && role !== "admin") {
    return res.status(400).json({
      status: "error",
      message: "Operación inválida. No puede revocar sus propios permisos de administrador.",
    });
  }

  try {
    const rowsAffected = await UserRepository.update(id, username, role);

    if (rowsAffected === 0) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado.",
      });
    }

    return res.json({
      status: "success",
      message: "Usuario actualizado correctamente.",
    });
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE")) {
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
};

/**
 * PUT /api/users/:id/password
 * Restablece la contraseña de un usuario por parte de un Administrador.
 */
export const changeUserPasswordByAdmin = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password || password.trim().length < 6) {
    return res.status(400).json({
      status: "error",
      message: "La contraseña debe tener al menos 6 caracteres.",
    });
  }

  try {
    const hashedPassword = hashPassword(password);
    
    // Si un administrador cambia su propia clave, se marca de inmediato como cambiada (password_changed = 1).
    // Si cambia la clave de otro usuario, se marca como pendiente (password_changed = 0) para forzar el cambio en su primer inicio.
    const isSelf = parseInt(id, 10) === req.user.id;
    const passwordChangedVal = isSelf ? 1 : 0;

    const rowsAffected = await UserRepository.updatePassword(id, hashedPassword, passwordChangedVal);

    if (rowsAffected === 0) {
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
  } catch (err) {
    console.error("Error al restablecer clave de usuario en SQLite:", err);
    return res.status(500).json({
      status: "error",
      message: "Error interno al restablecer la contraseña.",
    });
  }
};

/**
 * DELETE /api/users/:id
 * Elimina un usuario por completo de la base de datos (Exclusivo Administrador).
 */
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  // Protección: Evitar la auto-eliminación
  if (parseInt(id, 10) === req.user.id) {
    return res.status(400).json({
      status: "error",
      message: "Operación inválida. No puede eliminar su propia cuenta de administrador.",
    });
  }

  try {
    const rowsAffected = await UserRepository.delete(id);

    if (rowsAffected === 0) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado.",
      });
    }

    return res.json({
      status: "success",
      message: "Usuario eliminado exitosamente.",
    });
  } catch (err) {
    console.error("Error al eliminar usuario en SQLite:", err);
    return res.status(500).json({
      status: "error",
      message: "Error interno al eliminar el usuario.",
    });
  }
};
