import { Router } from "express";
import {
  getCameras,
  controlStream,
  getCameraControls,
  setCameraControl,
  getFfmpegDebug,
  killFfmpegProcess,
  killAllFfmpegProcesses,
  saveCameraLabel,
} from "./domains/camera.controller.js";
import {
  getLayouts,
  createLayout,
  deleteLayout,
} from "./domains/layout.controller.js";
import { validateStreamRequest } from "./middlewares/camera.validation.js";
import {
  login,
  changePassword,
  getUsers,
  createUser,
  updateUser,
  changeUserPasswordByAdmin,
  deleteUser,
} from "./domains/auth.controller.js";
import {
  getNodes,
  createNode,
  updateNode,
  deleteNode,
} from "./domains/node.controller.js";
import {
  authMiddleware,
  changePasswordMiddleware,
  adminMiddleware,
} from "./middlewares/auth.middleware.js";
import { DEBUG_MODE } from "./config/env.config.js";

const router = Router();

// Ruta de estado de depuración (pública)
router.get("/debug-mode", (req, res) => {
  res.json({ debugMode: DEBUG_MODE });
});

// Rutas Públicas de Autenticación
router.post("/auth/login", login);

// Ruta Protegida de Cambio Obligatorio de Contraseña (permite token temporal)
router.post("/auth/change-password", changePasswordMiddleware, changePassword);

// Rutas CRUD de Usuarios (Protegidas: requiere login y privilegios de Administrador)
router.get("/users", authMiddleware, adminMiddleware, getUsers);
router.post("/users", authMiddleware, adminMiddleware, createUser);
router.put("/users/:id", authMiddleware, adminMiddleware, updateUser);
router.put(
  "/users/:id/password",
  authMiddleware,
  adminMiddleware,
  changeUserPasswordByAdmin,
);
router.delete("/users/:id", authMiddleware, adminMiddleware, deleteUser);

// Rutas CRUD de Nodos Edge (Protegidas: requiere administrador)
router.get("/nodes", authMiddleware, adminMiddleware, getNodes);
router.post("/nodes", authMiddleware, adminMiddleware, createNode);
router.put("/nodes/:id", authMiddleware, adminMiddleware, updateNode);
router.delete("/nodes/:id", authMiddleware, adminMiddleware, deleteNode);

router.use("/cameras", authMiddleware);
router.get("/cameras", getCameras);
router.post("/cameras/stream", validateStreamRequest, controlStream);
router.post("/cameras/label", saveCameraLabel);

router.get("/cameras/controls", getCameraControls);
router.post("/cameras/controls", setCameraControl);
router.get("/cameras/debug/ffmpeg", getFfmpegDebug);
router.post("/cameras/debug/ffmpeg/kill", killFfmpegProcess);
router.post("/cameras/debug/ffmpeg/kill-all", killAllFfmpegProcesses);

router.get("/cameras/layouts", getLayouts);
router.post("/cameras/layouts", createLayout);
router.delete("/cameras/layouts/:id", deleteLayout);

export default router;
