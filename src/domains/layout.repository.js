import db from "../config/db.js";

export const LayoutRepository = {
  getAll() {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT id, camera_count, label, cols, rows, default_ratios, cells, is_custom FROM layouts",
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

  create(cameraCount, label, cols, rows, defaultRatios, cells, isCustom = 1) {
    const trimmedLabel = label.trim();
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO layouts (camera_count, label, cols, rows, default_ratios, cells, is_custom) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [cameraCount, trimmedLabel, cols, rows, defaultRatios, cells, isCustom],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              camera_count: cameraCount,
              label: trimmedLabel,
              cols,
              rows,
              default_ratios: defaultRatios,
              cells,
              is_custom: isCustom,
            });
          }
        }
      );
    });
  },

  delete(id) {
    return new Promise((resolve, reject) => {
      db.run(
        "DELETE FROM layouts WHERE id = ? AND is_custom = 1",
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
