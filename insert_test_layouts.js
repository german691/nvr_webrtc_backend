import sqlite3 from "sqlite3";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "../nvr.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to SQLite:", err);
    process.exit(1);
  }
  console.log("Database connected successfully at:", dbPath);
  insertLayouts();
});

function insertLayouts() {
  db.serialize(() => {
    const stmt = db.prepare(
      "INSERT INTO layouts (camera_count, label, cols, rows, default_ratios, cells, is_custom) VALUES (?, ?, ?, ?, ?, ?, 1)",
    );

    for (let i = 1; i <= 20; i++) {
      const camera_count = Math.floor(Math.random() * 8) + 2;
      const cols = Math.floor(Math.random() * 4) + 2;
      const rows = Math.floor(Math.random() * 4) + 2;
      const label = `Rejilla de prueba ${i} (${cols}x${rows})`;

      const cells = [];
      for (let cIdx = 0; cIdx < camera_count; cIdx++) {
        const gridColumn = String((cIdx % cols) + 1);
        const gridRow = String(Math.floor(cIdx / cols) + 1);
        cells.push({
          gridColumn,
          gridRow,
          isPrimary: cIdx === 0,
        });
      }

      stmt.run([
        camera_count,
        label,
        cols,
        rows,
        JSON.stringify({}),
        JSON.stringify(cells),
      ]);
    }

    stmt.finalize((err) => {
      if (err) {
        console.error("Error inserting layouts:", err);
      } else {
        console.log("20 custom test layouts inserted successfully!");
      }
      db.close();
    });
  });
}
