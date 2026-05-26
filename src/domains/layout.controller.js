import { LayoutRepository } from "./layout.repository.js";

export const getLayouts = async (req, res) => {
  try {
    const rows = await LayoutRepository.getAll();
    const formatted = {};
    const grouped = {};

    rows.forEach((row) => {
      if (!grouped[row.camera_count]) {
        grouped[row.camera_count] = [];
      }
      grouped[row.camera_count].push(row);
    });

    Object.keys(grouped).forEach((cameraCount) => {
      const groupRows = grouped[cameraCount];
      groupRows.sort((a, b) => {
        if (a.is_custom !== b.is_custom) {
          return a.is_custom - b.is_custom;
        }
        return a.id - b.id;
      });

      formatted[cameraCount] = {};
      groupRows.forEach((row, index) => {
        const layoutKey = String(index + 1);
        formatted[cameraCount][layoutKey] = {
          id: row.id,
          label: row.label,
          cols: row.cols,
          rows: row.rows,
          defaultRatios: JSON.parse(row.default_ratios || "{}"),
          cells: JSON.parse(row.cells || "[]"),
          isCustom: row.is_custom === 1,
        };
      });
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createLayout = async (req, res) => {
  try {
    const { camera_count, label, cols, rows, default_ratios, cells } = req.body;

    if (!camera_count || !label || !cols || !rows || !cells) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const defaultRatiosStr = typeof default_ratios === "string" 
      ? default_ratios 
      : JSON.stringify(default_ratios || {});

    const cellsStr = typeof cells === "string"
      ? cells
      : JSON.stringify(cells);

    const newLayout = await LayoutRepository.create(
      Number(camera_count),
      label,
      Number(cols),
      Number(rows),
      defaultRatiosStr,
      cellsStr,
      1
    );

    res.status(201).json(newLayout);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteLayout = async (req, res) => {
  try {
    const { id } = req.params;
    const affectedRows = await LayoutRepository.delete(Number(id));

    if (affectedRows === 0) {
      return res.status(404).json({ error: "Layout no encontrado o no se puede eliminar" });
    }

    res.json({ message: "Layout eliminado con éxito" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
