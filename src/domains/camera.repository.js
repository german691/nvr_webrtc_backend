import db from "../config/db.js";

export const CameraRepository = {
  getLabel(nodeIp, persistentPath) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT custom_name FROM camera_labels WHERE node_ip = ? AND persistent_path = ?",
        [nodeIp, persistentPath],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row ? row.custom_name : null);
          }
        }
      );
    });
  },

  getAllLabels(nodeIp) {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT persistent_path, custom_name FROM camera_labels WHERE node_ip = ?",
        [nodeIp],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const map = {};
            if (rows) {
              rows.forEach((row) => {
                map[row.persistent_path] = row.custom_name;
              });
            }
            resolve(map);
          }
        }
      );
    });
  },

  saveLabel(nodeIp, persistentPath, customName) {
    const trimmedName = customName.trim();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO camera_labels (node_ip, persistent_path, custom_name)
         VALUES (?, ?, ?)
         ON CONFLICT(persistent_path)
         DO UPDATE SET custom_name = excluded.custom_name`,
        [nodeIp, persistentPath, trimmedName],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              node_ip: nodeIp,
              persistent_path: persistentPath,
              custom_name: trimmedName,
            });
          }
        }
      );
    });
  }
};
