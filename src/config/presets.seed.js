export const initialPresets = [
  {
    camera_count: 2,
    label: "Lado a lado",
    cols: 2,
    rows: 1,
    default_ratios: "{}",
    cells: JSON.stringify([
      { gridColumn: "1", gridRow: "1", isPrimary: true },
      { gridColumn: "2", gridRow: "1", isPrimary: true }
    ]),
    is_custom: 0
  },
  {
    camera_count: 2,
    label: "Vertical",
    cols: 1,
    rows: 2,
    default_ratios: "{}",
    cells: JSON.stringify([
      { gridColumn: "1", gridRow: "1", isPrimary: true },
      { gridColumn: "1", gridRow: "2", isPrimary: true }
    ]),
    is_custom: 0
  },
  {
    camera_count: 3,
    label: "Diseño 1",
    cols: 2,
    rows: 2,
    default_ratios: JSON.stringify({ colRatio: 33.33 }),
    cells: JSON.stringify([
      { gridColumn: "2", gridRow: "1 / span 2", isPrimary: true },
      { gridColumn: "1", gridRow: "1", isPrimary: false },
      { gridColumn: "1", gridRow: "2", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 3,
    label: "Diseño 2",
    cols: 2,
    rows: 2,
    default_ratios: JSON.stringify({ rowRatio: 66.66 }),
    cells: JSON.stringify([
      { gridColumn: "1 / span 2", gridRow: "1", isPrimary: true },
      { gridColumn: "1", gridRow: "2", isPrimary: false },
      { gridColumn: "2", gridRow: "2", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 3,
    label: "Diseño 3",
    cols: 3,
    rows: 1,
    default_ratios: JSON.stringify({ colRatio: 33.33, colRatio2: 66.66 }),
    cells: JSON.stringify([
      { gridColumn: "1", gridRow: "1", isPrimary: true },
      { gridColumn: "2", gridRow: "1", isPrimary: true },
      { gridColumn: "3", gridRow: "1", isPrimary: true }
    ]),
    is_custom: 0
  },
  {
    camera_count: 4,
    label: "Diseño 1",
    cols: 2,
    rows: 3,
    default_ratios: JSON.stringify({ colRatio: 33.33 }),
    cells: JSON.stringify([
      { gridColumn: "2", gridRow: "1 / span 3", isPrimary: true },
      { gridColumn: "1", gridRow: "1", isPrimary: false },
      { gridColumn: "1", gridRow: "2", isPrimary: false },
      { gridColumn: "1", gridRow: "3", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 4,
    label: "Diseño 2",
    cols: 3,
    rows: 2,
    default_ratios: JSON.stringify({ rowRatio: 66.66 }),
    cells: JSON.stringify([
      { gridColumn: "1 / span 3", gridRow: "1", isPrimary: true },
      { gridColumn: "1", gridRow: "2", isPrimary: false },
      { gridColumn: "2", gridRow: "2", isPrimary: false },
      { gridColumn: "3", gridRow: "2", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 4,
    label: "Diseño 3 (Defecto)",
    cols: 2,
    rows: 2,
    default_ratios: "{}",
    cells: JSON.stringify([
      { gridColumn: "1", gridRow: "1", isPrimary: false },
      { gridColumn: "2", gridRow: "1", isPrimary: false },
      { gridColumn: "1", gridRow: "2", isPrimary: false },
      { gridColumn: "2", gridRow: "2", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 4,
    label: "Diseño 4",
    cols: 2,
    rows: 2,
    default_ratios: JSON.stringify({ colRatio: 33.33, rowRatio: 66.66 }),
    cells: JSON.stringify([
      { gridColumn: "2", gridRow: "1", isPrimary: true },
      { gridColumn: "1", gridRow: "1", isPrimary: false },
      { gridColumn: "1", gridRow: "2", isPrimary: false },
      { gridColumn: "2", gridRow: "2", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 5,
    label: "Diseño 1",
    cols: 3,
    rows: 3,
    default_ratios: JSON.stringify({ colRatio: 33.33, colRatio2: 66.66, rowRatio: 33.33, rowRatio2: 66.66 }),
    cells: JSON.stringify([
      { gridColumn: "2 / span 2", gridRow: "1 / span 2", isPrimary: true },
      { gridColumn: "1", gridRow: "1", isPrimary: false },
      { gridColumn: "1", gridRow: "2", isPrimary: false },
      { gridColumn: "1", gridRow: "3", isPrimary: false },
      { gridColumn: "2 / span 2", gridRow: "3", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 5,
    label: "Diseño 2",
    cols: 2,
    rows: 6,
    default_ratios: JSON.stringify({ colRatio: 33.33 }),
    cells: JSON.stringify([
      { gridColumn: "2", gridRow: "1 / span 3", isPrimary: true },
      { gridColumn: "2", gridRow: "4 / span 3", isPrimary: true },
      { gridColumn: "1", gridRow: "1 / span 2", isPrimary: false },
      { gridColumn: "1", gridRow: "3 / span 2", isPrimary: false },
      { gridColumn: "1", gridRow: "5 / span 2", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 6,
    label: "Diseño 1 (Defecto)",
    cols: 3,
    rows: 2,
    default_ratios: JSON.stringify({ colRatio: 33.33, colRatio2: 66.66, rowRatio: 50 }),
    cells: JSON.stringify([
      { gridColumn: "1", gridRow: "1", isPrimary: false },
      { gridColumn: "2", gridRow: "1", isPrimary: false },
      { gridColumn: "3", gridRow: "1", isPrimary: false },
      { gridColumn: "1", gridRow: "2", isPrimary: false },
      { gridColumn: "2", gridRow: "2", isPrimary: false },
      { gridColumn: "3", gridRow: "2", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 6,
    label: "Diseño 2",
    cols: 2,
    rows: 4,
    default_ratios: JSON.stringify({ colRatio: 30 }),
    cells: JSON.stringify([
      { gridColumn: "2", gridRow: "1 / span 2", isPrimary: true },
      { gridColumn: "2", gridRow: "3 / span 2", isPrimary: true },
      { gridColumn: "1", gridRow: "1", isPrimary: false },
      { gridColumn: "1", gridRow: "2", isPrimary: false },
      { gridColumn: "1", gridRow: "3", isPrimary: false },
      { gridColumn: "1", gridRow: "4", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 6,
    label: "Diseño 3",
    cols: 3,
    rows: 3,
    default_ratios: JSON.stringify({ colRatio: 33.33, colRatio2: 66.66, rowRatio: 33.33, rowRatio2: 66.66 }),
    cells: JSON.stringify([
      { gridColumn: "2 / span 2", gridRow: "1 / span 2", isPrimary: true },
      { gridColumn: "1", gridRow: "1", isPrimary: false },
      { gridColumn: "1", gridRow: "2", isPrimary: false },
      { gridColumn: "1", gridRow: "3", isPrimary: false },
      { gridColumn: "2", gridRow: "3", isPrimary: false },
      { gridColumn: "3", gridRow: "3", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 7,
    label: "Diseño 1",
    cols: 4,
    rows: 3,
    default_ratios: JSON.stringify({ rowRatio: 33, rowRatio2: 66 }),
    cells: JSON.stringify([
      { gridColumn: "3 / span 2", gridRow: "1 / span 2", isPrimary: true },
      { gridColumn: "1", gridRow: "1", isPrimary: false },
      { gridColumn: "2", gridRow: "1", isPrimary: false },
      { gridColumn: "1", gridRow: "2", isPrimary: false },
      { gridColumn: "2", gridRow: "2", isPrimary: false },
      { gridColumn: "1 / span 2", gridRow: "3", "isPrimary": false },
      { gridColumn: "3 / span 2", gridRow: "3", "isPrimary": false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 7,
    label: "Diseño 2",
    cols: 4,
    rows: 3,
    default_ratios: "{}",
    cells: JSON.stringify([
      { gridColumn: "3 / span 2", gridRow: "1 / span 3", isPrimary: true },
      { gridColumn: "1", gridRow: "1", isPrimary: false },
      { gridColumn: "2", gridRow: "1", isPrimary: false },
      { gridColumn: "1", gridRow: "2", isPrimary: false },
      { gridColumn: "2", gridRow: "2", isPrimary: false },
      { gridColumn: "1", gridRow: "3", isPrimary: false },
      { gridColumn: "2", gridRow: "3", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 8,
    label: "Diseño 1 (Defecto)",
    cols: 4,
    rows: 2,
    default_ratios: "{}",
    cells: JSON.stringify([
      { gridColumn: "1", gridRow: "1", isPrimary: false },
      { gridColumn: "2", gridRow: "1", isPrimary: false },
      { gridColumn: "3", gridRow: "1", isPrimary: false },
      { gridColumn: "4", gridRow: "1", isPrimary: false },
      { gridColumn: "1", gridRow: "2", isPrimary: false },
      { gridColumn: "2", gridRow: "2", isPrimary: false },
      { gridColumn: "3", gridRow: "2", isPrimary: false },
      { gridColumn: "4", gridRow: "2", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 8,
    label: "Diseño 2",
    cols: 4,
    rows: 3,
    default_ratios: JSON.stringify({ rowRatio: 33.5, rowRatio2: 66.5 }),
    cells: JSON.stringify([
      { gridColumn: "3 / span 2", gridRow: "1 / span 2", isPrimary: true },
      { gridColumn: "1", gridRow: "1", isPrimary: false },
      { gridColumn: "2", gridRow: "1", isPrimary: false },
      { gridColumn: "1", gridRow: "2", isPrimary: false },
      { gridColumn: "2", gridRow: "2", isPrimary: false },
      { gridColumn: "1", gridRow: "3", isPrimary: false },
      { gridColumn: "2", gridRow: "3", isPrimary: false },
      { gridColumn: "3 / span 2", gridRow: "3", isPrimary: false }
    ]),
    is_custom: 0
  },
  {
    camera_count: 8,
    label: "Diseño 3",
    cols: 4,
    rows: 6,
    default_ratios: "{}",
    cells: JSON.stringify([
      { gridColumn: "3 / span 2", gridRow: "1 / span 3", isPrimary: true },
      { gridColumn: "3 / span 2", gridRow: "4 / span 3", isPrimary: true },
      { gridColumn: "1", gridRow: "1 / span 2", isPrimary: false },
      { gridColumn: "2", gridRow: "1 / span 2", isPrimary: false },
      { gridColumn: "1", gridRow: "3 / span 2", isPrimary: false },
      { gridColumn: "2", gridRow: "3 / span 2", isPrimary: false },
      { gridColumn: "1", gridRow: "5 / span 2", isPrimary: false },
      { gridColumn: "2", gridRow: "5 / span 2", isPrimary: false }
    ]),
    is_custom: 0
  }
];
