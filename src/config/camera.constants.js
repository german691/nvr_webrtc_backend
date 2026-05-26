export const MOCK_CAMERAS = [
  {
    dev: "/dev/video0",
    name: "Cámara Acceso Principal",
    modes: [
      { resolution: "1920x1080", fps: [30, 24, 15] },
      { resolution: "1280x720", fps: [60, 30, 24] },
      { resolution: "640x480", fps: [30, 15] }
    ]
  },
  {
    dev: "/dev/video1",
    name: "Cámara Sala de Espera",
    modes: [
      { resolution: "1920x1080", fps: [30, 24] },
      { resolution: "1280x720", fps: [30, 24, 15] },
      { resolution: "640x360", fps: [30] }
    ]
  },
  {
    dev: "/dev/video2",
    name: "Cámara Pasillo Dental A",
    modes: [
      { resolution: "1280x720", fps: [30, 15] },
      { resolution: "640x480", fps: [30, 15] }
    ]
  },
  {
    dev: "/dev/video3",
    name: "Cámara Quirófano 1",
    modes: [
      { resolution: "1920x1080", fps: [60, 30, 24] },
      { resolution: "1280x720", fps: [60, 30] }
    ]
  },
  {
    dev: "/dev/video4",
    name: "Cámara Quirófano 2",
    modes: [
      { resolution: "1920x1080", fps: [30, 24] },
      { resolution: "1280x720", fps: [30] }
    ]
  },
  {
    dev: "/dev/video5",
    name: "Cámara Box Odontológico A",
    modes: [
      { resolution: "1280x720", fps: [30, 15] },
      { resolution: "640x480", fps: [30] }
    ]
  },
  {
    dev: "/dev/video6",
    name: "Cámara Box Odontológico B",
    modes: [
      { resolution: "1280x720", fps: [30, 15] },
      { resolution: "640x480", fps: [30] }
    ]
  },
  {
    dev: "/dev/video7",
    name: "Cámara Sector Esterilización",
    modes: [
      { resolution: "1920x1080", fps: [30, 24] },
      { resolution: "1280x720", fps: [30, 15] }
    ]
  }
];

export const DEFAULT_UVC_CONTROLS = [
  { name: "brightness", type: "int", min: 0, max: 255, step: 1, default: 128 },
  { name: "contrast", type: "int", min: 0, max: 255, step: 1, default: 128 },
  { name: "saturation", type: "int", min: 0, max: 255, step: 1, default: 128 },
  { name: "sharpness", type: "int", min: 0, max: 255, step: 1, default: 128 },
  { name: "gamma", type: "int", min: 90, max: 150, step: 1, default: 100 },
  { name: "focus_auto", type: "bool", min: 0, max: 1, step: 1, default: 1 },
  { name: "focus_absolute", type: "int", min: 0, max: 250, step: 5, default: 50 },
  { name: "zoom_absolute", type: "int", min: 100, max: 500, step: 10, default: 100 },
  { name: "pan_absolute", type: "int", min: -36000, max: 36000, step: 3600, default: 0 },
  { name: "tilt_absolute", type: "int", min: -36000, max: 36000, step: 3600, default: 0 }
];

export const USEFUL_UVC_CONTROLS = [
  "brightness",
  "contrast",
  "saturation",
  "hue",
  "sharpness",
  "gamma",
  "focus_auto",
  "focus_automatic_continuous",
  "auto_focus",
  "focus_absolute",
  "focus",
  "zoom_absolute",
  "zoom",
  "zoom_auto",
  "pan_absolute",
  "tilt_absolute"
];
