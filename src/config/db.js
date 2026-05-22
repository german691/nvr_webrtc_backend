import sqlite3 from "sqlite3";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { NVR_USERNAME, NVR_PASSWORD } from "./env.config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "../../../nvr.db");

// Función de utilidad para hashear contraseñas usando el módulo nativo crypto (SHA-256)
export const hashPassword = (password) => {
  return crypto.createHash("sha256").update(password).digest("hex");
};

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error al abrir la base de datos SQLite:", err);
  } else {
    console.log("Base de datos SQLite conectada en:", dbPath);
    initializeDb();
  }
});

function initializeDb() {
  db.serialize(() => {
    // 1. Crear tabla de usuarios
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )`,
      (err) => {
        if (err) {
          console.error("Error al crear la tabla de usuarios:", err);
        } else {
          seedUser();
        }
      }
    );
  });
}

function seedUser() {
  db.serialize(() => {
    // Limpiamos la tabla para garantizar que solo exista el usuario configurado en .env
    db.run("DELETE FROM users", [], (err) => {
      if (err) {
        console.error("Error al limpiar la tabla de usuarios:", err);
        return;
      }

      const hashedPassword = hashPassword(NVR_PASSWORD);
      db.run(
        "INSERT INTO users (id, username, password) VALUES (1, ?, ?)",
        [NVR_USERNAME, hashedPassword],
        (err) => {
          if (err) {
            console.error("Error al sembrar el usuario único:", err);
          } else {
            console.log(`Usuario único "${NVR_USERNAME}" sembrado con éxito en SQLite.`);
          }
        }
      );
    });
  });
}

export default db;
