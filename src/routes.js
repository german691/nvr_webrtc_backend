import { Router } from "express";
import {
  getCameras,
  controlStream,
  getCameraControls,
  setCameraControl,
  getFfmpegDebug,
  killFfmpegProcess,
  killAllFfmpegProcesses,
} from "./domains/camera.controller.js";
import { validateStreamRequest } from "./middlewares/camera.validation.js";
import { login } from "./domains/auth.controller.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";

const router = Router();

// Rutas Públicas de Autenticación
router.post("/auth/login", login);

// Rutas Protegidas de Cámaras (Aplican el middleware de autenticación globalmente)
router.use("/cameras", authMiddleware);

// Endpoints del dominio de Cámaras
router.get("/cameras", getCameras);
router.post("/cameras/stream", validateStreamRequest, controlStream);

router.get("/cameras/controls", getCameraControls);
router.post("/cameras/controls", setCameraControl);
router.get("/cameras/debug/ffmpeg", getFfmpegDebug);
router.post("/cameras/debug/ffmpeg/kill", killFfmpegProcess);
router.post("/cameras/debug/ffmpeg/kill-all", killAllFfmpegProcesses);

export default router;
