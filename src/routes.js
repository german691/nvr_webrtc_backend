import { Router } from "express";
import {
  getCameras,
  controlStream,
  getCameraControls,
  setCameraControl,
} from "./domains/camera.controller.js";
import { validateStreamRequest } from "./middlewares/camera.validation.js";

const router = Router();

// Endpoints del dominio de Cámaras
router.get("/cameras", getCameras);
router.post("/cameras/stream", validateStreamRequest, controlStream);

router.get("/cameras/controls", getCameraControls);
router.post("/cameras/controls", setCameraControl);

// Aquí podrás agregar en el futuro:
// router.use("/auth", authRoutes);
// router.get("/config", getConfig);

export default router;
