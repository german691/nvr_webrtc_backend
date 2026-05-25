import sqlite3 from "sqlite3";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "../../../nvr.db");

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
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        password_changed INTEGER DEFAULT 0,
        role TEXT NOT NULL DEFAULT 'viewer'
      )`,
      (err) => {
        if (err) {
          console.error("Error al crear la tabla de usuarios:", err);
        } else {
          db.run(
            "ALTER TABLE users ADD COLUMN password_changed INTEGER DEFAULT 0",
            (alterErr) => {
              db.run(
                "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer'",
                (roleErr) => {
                  checkAndSeed();
                }
              );
            }
          );
        }
      }
    );
  });
}

function checkAndSeed() {
  db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
    if (err) {
      console.error("Error al contar usuarios en SQLite:", err);
    } else if (!row || row.count === 0) {
      seedUser();
    } else {
      console.log("Base de datos ya cuenta con usuarios registrados. Omitiendo siembra.");
    }
  });
}

function seedUser() {
  db.serialize(() => {
    db.run("DELETE FROM users", [], (err) => {
      if (err) {
        console.error("Error al limpiar la tabla de usuarios:", err);
        return;
      }

      const defaultUser = "tecnologia";
      const defaultPass = "Tecn02026+";
      const hashedPassword = hashPassword(defaultPass);
      
      db.run(
        "INSERT INTO users (id, username, password, password_changed, role) VALUES (1, ?, ?, 0, 'admin')",
        [defaultUser, hashedPassword],
        (err) => {
          if (err) {
            console.error("Error al sembrar el usuario único:", err);
          } else {
            console.log(`Usuario único "${defaultUser}" sembrado con éxito en SQLite (rol admin, cambio de pass pendiente).`);
          }
        }
      );
    });
  });
}

export default db;
