import db from "../config/db.js";

/**
 * Repositorio de Usuarios
 * Abstrae y encapsula todas las operaciones sobre la tabla 'users' de la base de datos SQLite.
 * Devuelve Promesas nativas de JavaScript para admitir flujos de control asíncronos limpios con async/await.
 */
export const UserRepository = {
  /**
   * Busca un usuario por su nombre de usuario.
   * @param {string} username Nombre de usuario a buscar
   * @returns {Promise<object|null>} Fila del usuario o null si no se encuentra
   */
  findByUsername(username) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM users WHERE username = ?",
        [username],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row || null);
          }
        }
      );
    });
  },

  /**
   * Busca un usuario por su ID numérico.
   * @param {number|string} id ID del usuario
   * @returns {Promise<object|null>} Fila del usuario o null si no se encuentra
   */
  findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM users WHERE id = ?",
        [id],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row || null);
          }
        }
      );
    });
  },

  /**
   * Obtiene todos los usuarios registrados (excluyendo la contraseña).
   * @returns {Promise<Array<object>>} Listado de todos los usuarios
   */
  getAll() {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT id, username, role, password_changed FROM users",
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  },

  /**
   * Crea e inserta un nuevo usuario en la base de datos.
   * @param {string} username Nombre de usuario
   * @param {string} hashedPassword Hash de la contraseña
   * @param {string} role Rol ('admin' o 'viewer')
   * @returns {Promise<object>} Objeto del usuario recién creado
   */
  create(username, hashedPassword, role) {
    const trimmedUsername = username.trim();
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO users (username, password, role, password_changed) VALUES (?, ?, ?, 0)",
        [trimmedUsername, hashedPassword, role],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              username: trimmedUsername,
              role,
              password_changed: 0,
            });
          }
        }
      );
    });
  },

  /**
   * Actualiza el nombre de usuario y el rol de un usuario existente.
   * @param {number|string} id ID del usuario
   * @param {string} username Nuevo nombre de usuario
   * @param {string} role Nuevo rol
   * @returns {Promise<number>} Cantidad de filas afectadas
   */
  update(id, username, role) {
    const trimmedUsername = username.trim();
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE users SET username = ?, role = ? WHERE id = ?",
        [trimmedUsername, role, id],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });
  },

  /**
   * Actualiza la contraseña y el indicador de cambio de contraseña de un usuario.
   * @param {number|string} id ID del usuario
   * @param {string} hashedPassword Hash de la nueva contraseña
   * @param {number} passwordChangedVal Valor para password_changed (1 = completado, 0 = pendiente)
   * @returns {Promise<number>} Cantidad de filas afectadas
   */
  updatePassword(id, hashedPassword, passwordChangedVal) {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE users SET password = ?, password_changed = ? WHERE id = ?",
        [hashedPassword, passwordChangedVal, id],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });
  },

  /**
   * Elimina un usuario por su ID de la base de datos.
   * @param {number|string} id ID del usuario a eliminar
   * @returns {Promise<number>} Cantidad de filas afectadas
   */
  delete(id) {
    return new Promise((resolve, reject) => {
      db.run(
        "DELETE FROM users WHERE id = ?",
        [id],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });
  }
};
