import { executeRemoteCommand, activeStreams } from "./camera.helper.js";
import { EDGE_HOST } from "../config/env.config.js";

// GET /api/cameras
export const getCameras = async (req, res) => {
  try {
    const rawJson = await executeRemoteCommand(
      "/usr/local/bin/get_capabilities.sh",
    );
    const cameras = JSON.parse(rawJson);

    const validCameras = cameras.filter(
      (cam) => cam.modes && cam.modes.length > 0,
    );

    const response = validCameras.map((cam) => {
      const streamPath = cam.dev.replace("/dev/", "");
      const activeStream = activeStreams.get(cam.dev);

      return {
        dev: cam.dev,
        name: cam.name,
        modes: cam.modes,
        streaming: !!activeStream,
        webrtc_url: activeStream
          ? `http://${EDGE_HOST}:8889/${streamPath}`
          : null,
        active_settings: activeStream
          ? {
              resolution: activeStream.resolution,
              fps: activeStream.fps,
              bitrate: activeStream.bitrate,
            }
          : null,
      };
    });

    res.json(response);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error de Orquestación SSH", details: error.message });
  }
};

// POST /api/cameras/stream
export const controlStream = async (req, res) => {
  const { dev, resolution, fps, cleanBitrate, action } = req.body;

  try {
    if (action === "stop") {
      const stopCmd = `pkill -9 -f "ffmpeg.*-i ${dev}" || true`;
      await executeRemoteCommand(stopCmd);
      activeStreams.delete(dev);

      return res.json({
        status: "success",
        message: `Cámara ${dev} liberada.`,
      });
    }

    let bitrateArg = cleanBitrate ? `-b:v ${cleanBitrate}` : "";

    const killCmd = `pkill -9 -f "ffmpeg.*-i ${dev}" || true`;
    await executeRemoteCommand(killCmd);
    activeStreams.delete(dev);

    const streamPath = dev.replace("/dev/", "");

    const ffmpegCmd = `/usr/bin/ffmpeg -hide_banner -loglevel error \
      -vaapi_device /dev/dri/renderD128 \
      -f v4l2 -input_format mjpeg -video_size ${resolution} -framerate ${fps} -i ${dev} \
      -vf 'format=nv12,hwupload' -c:v h264_vaapi -bf 0 ${bitrateArg ? bitrateArg + " " : ""}\
      -f rtsp rtsp://localhost:8554/${streamPath} > /dev/null 2>&1 & echo \$!`;

    const assignedPid = await executeRemoteCommand(ffmpegCmd);
    const pidNum = parseInt(assignedPid, 10);

    if (!assignedPid || isNaN(pidNum)) {
      throw new Error("Fallo al obtener PID del hardware de captura");
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    activeStreams.set(dev, {
      pid: pidNum,
      resolution,
      fps,
      bitrate: cleanBitrate,
    });

    res.json({
      status: "success",
      message: `Hardware activado a ${resolution} @ ${fps} FPS.`,
      pid: pidNum,
      webrtc_url: `http://${EDGE_HOST}:8889/${streamPath}`,
      active_settings: {
        resolution,
        fps,
        bitrate: cleanBitrate,
        data: ffmpegCmd,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error iniciando hardware", details: error.message });
  }
};

// GET /api/cameras/controls?dev=/dev/video0
export const getCameraControls = async (req, res) => {
  const { dev } = req.query;

  if (!dev || !/^\/dev\/(video|cam)[a-zA-Z0-9_]+$/.test(dev)) {
    return res.status(400).json({ error: "Dispositivo 'dev' inválido" });
  }

  try {
    // Consultamos los controles nativos directamente al hardware
    const rawOutput = await executeRemoteCommand(
      `v4l2-ctl -d ${dev} --list-ctrls`,
    );

    const controls = [];
    const lines = rawOutput.split("\n");

    for (let line of lines) {
      // Parseamos la salida de v4l2-ctl mediante Expresiones Regulares
      // Ejemplo: "brightness 0x00980900 (int)    : min=0 max=255 step=1 default=128 value=128"
      const match = line.match(
        /^\s*([a-zA-Z0-9_]+).*?\((int|bool)\)\s*:\s*(.*)$/,
      );

      if (match) {
        const name = match[1];
        const type = match[2];
        const propsStr = match[3];

        const control = { name, type };

        // Extraemos min, max, step y value
        propsStr.split(" ").forEach((prop) => {
          const [key, val] = prop.split("=");
          if (key && val !== undefined) {
            control[key] = parseInt(val, 10);
          }
        });

        // Filtramos solo los controles útiles para la interfaz gráfica
        const usefulControls = [
          "brightness",
          "contrast",
          "saturation",
          "hue",
          "sharpness",
          "gamma",
        ];
        if (usefulControls.includes(name)) {
          controls.push(control);
        }
      }
    }

    res.json({ status: "success", dev, controls });
  } catch (error) {
    res.status(500).json({
      error: "Error obteniendo controles UVC",
      details: error.message,
    });
  }
};

// POST /api/cameras/controls
export const setCameraControl = async (req, res) => {
  const { dev, controlName, value } = req.body;

  if (!dev || !controlName || value === undefined) {
    return res
      .status(400)
      .json({ error: "Faltan parámetros (dev, controlName, value)" });
  }

  try {
    // Inyectamos el comando UVC directamente en la Mini-PC
    const cmd = `v4l2-ctl -d ${dev} --set-ctrl=${controlName}=${value}`;
    await executeRemoteCommand(cmd);

    res.json({
      status: "success",
      message: `Control ${controlName} ajustado a ${value}`,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error ajustando el hardware", details: error.message });
  }
};
