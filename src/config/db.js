import sqlite3 from "sqlite3";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initialPresets } from "./presets.seed.js";

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

    db.run(
      `CREATE TABLE IF NOT EXISTS layouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        camera_count INTEGER NOT NULL,
        label TEXT NOT NULL,
        cols INTEGER NOT NULL,
        rows INTEGER NOT NULL,
        default_ratios TEXT,
        cells TEXT NOT NULL,
        is_custom INTEGER DEFAULT 1
      )`,
      (err) => {
        if (err) {
          console.error("Error al crear la tabla de layouts:", err);
        } else {
          checkAndSeedLayouts();
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

function checkAndSeedLayouts() {
  db.get("SELECT COUNT(*) as count FROM layouts", [], (err, row) => {
    if (err) {
      console.error("Error al contar layouts en SQLite:", err);
    } else if (!row || row.count === 0) {
      seedLayouts();
    } else {
      console.log("Base de datos ya cuenta con layouts registrados. Omitiendo siembra.");
    }
  });
}

function seedLayouts() {
  db.serialize(() => {
    db.run("DELETE FROM layouts", [], (err) => {
      if (err) {
        console.error("Error al limpiar la tabla de layouts:", err);
        return;
      }

      const stmt = db.prepare(
        "INSERT INTO layouts (camera_count, label, cols, rows, default_ratios, cells, is_custom) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      for (const preset of initialPresets) {
        stmt.run([
          preset.camera_count,
          preset.label,
          preset.cols,
          preset.rows,
          preset.default_ratios,
          preset.cells,
          preset.is_custom,
        ]);
      }
      stmt.finalize((errFinal) => {
        if (errFinal) {
          console.error("Error al finalizar la siembra de layouts:", errFinal);
        } else {
          console.log("Layouts de fábrica sembrados con éxito en SQLite.");
        }
      });
    });
  });
}

export default db;
