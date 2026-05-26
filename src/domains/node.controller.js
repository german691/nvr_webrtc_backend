import db from "../config/db.js";

// GET /api/nodes
export const getNodes = async (req, res) => {
  try {
    db.all("SELECT id, ip, port, username, password, label FROM edge_nodes", [], (err, rows) => {
      if (err) {
        return res.status(500).json({ status: "error", message: err.message });
      }
      res.json({ status: "success", nodes: rows });
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// POST /api/nodes
export const createNode = async (req, res) => {
  try {
    const { ip, port, username, password, label } = req.body;

    if (!ip || !username || !password) {
      return res.status(400).json({ status: "error", message: "Faltan campos obligatorios (ip, username, password)" });
    }

    const nodePort = parseInt(port, 10) || 22;

    db.run(
      "INSERT INTO edge_nodes (ip, port, username, password, label) VALUES (?, ?, ?, ?, ?)",
      [ip.trim(), nodePort, username.trim(), password, label ? label.trim() : null],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE")) {
            return res.status(400).json({ status: "error", message: "Ya existe un nodo con esta dirección IP" });
          }
          return res.status(500).json({ status: "error", message: err.message });
        }
        res.status(201).json({
          status: "success",
          node: {
            id: this.lastID,
            ip: ip.trim(),
            port: nodePort,
            username: username.trim(),
            password,
            label: label ? label.trim() : null
          }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// PUT /api/nodes/:id
export const updateNode = async (req, res) => {
  try {
    const { id } = req.params;
    const { ip, port, username, password, label } = req.body;

    if (!ip || !username || !password) {
      return res.status(400).json({ status: "error", message: "Faltan campos obligatorios (ip, username, password)" });
    }

    const nodePort = parseInt(port, 10) || 22;

    db.run(
      "UPDATE edge_nodes SET ip = ?, port = ?, username = ?, password = ?, label = ? WHERE id = ?",
      [ip.trim(), nodePort, username.trim(), password, label ? label.trim() : null, Number(id)],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE")) {
            return res.status(400).json({ status: "error", message: "Ya existe un nodo con esta dirección IP" });
          }
          return res.status(500).json({ status: "error", message: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ status: "error", message: "Nodo no encontrado" });
        }
        res.json({ status: "success", message: "Nodo actualizado con éxito" });
      }
    );
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// DELETE /api/nodes/:id
export const deleteNode = async (req, res) => {
  try {
    const { id } = req.params;

    db.run("DELETE FROM edge_nodes WHERE id = ?", [Number(id)], function (err) {
      if (err) {
        return res.status(500).json({ status: "error", message: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ status: "error", message: "Nodo no encontrado" });
      }
      res.json({ status: "success", message: "Nodo eliminado con éxito" });
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
