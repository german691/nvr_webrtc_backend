import { executeRemoteCommand, activeStreams } from "./camera.helper.js";
import { EDGE_HOST } from "../config/env.config.js";

// Sincroniza el mapa activeStreams en memoria con los procesos FFmpeg reales en el host remoto
export const syncActiveStreamsWithHost = async () => {
  try {
    const rawOutput = await executeRemoteCommand(
      "ps aux | grep ffmpeg | grep -v grep || true"
    );

    const foundDevices = new Set();

    if (rawOutput && rawOutput.trim() !== "") {
      const lines = rawOutput.split("\n");

      for (let line of lines) {
        const trimmed = line.trim();
        if (trimmed === "" || !trimmed.includes("ffmpeg") || trimmed.includes("grep")) {
          continue;
        }

        const tokens = trimmed.split(/\s+/);
        if (tokens.length < 11) {
          continue;
        }

        const pid = parseInt(tokens[1], 10);
        const command = tokens.slice(10).join(" ");

        // Parseo de argumentos con expresiones regulares
        const deviceMatch = command.match(/-i\s+([^\s]+)/);
        const device = deviceMatch ? deviceMatch[1] : null;

        if (!device || !device.startsWith("/dev/")) {
          continue;
        }

        const resolutionMatch = command.match(/-video_size\s+([^\s]+)/);
        const resolution = resolutionMatch ? resolutionMatch[1] : "N/A";

        const fpsMatch = command.match(/-framerate\s+([^\s]+)/);
        const fps = fpsMatch ? fpsMatch[1] : "N/A";

        const bitrateMatch = command.match(/-b:v\s+([^\s]+)/);
        const bitrate = bitrateMatch ? bitrateMatch[1] : "N/A";

        foundDevices.add(device);

        // Actualizamos o insertamos el stream en memoria
        activeStreams.set(device, {
          pid,
          resolution,
          fps,
          bitrate,
        });
      }
    }

    // Eliminamos de activeStreams cualquier dispositivo que ya no tenga proceso activo en el host remoto
    for (let dev of activeStreams.keys()) {
      if (!foundDevices.has(dev)) {
        activeStreams.delete(dev);
      }
    }
  } catch (error) {
    console.error("Error al sincronizar activeStreams con el host:", error.message);
  }
};

// GET /api/cameras
export const getCameras = async (req, res) => {
  try {
    // Sincronizamos dinámicamente con los procesos reales en el host remoto
    await syncActiveStreamsWithHost();

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

// GET /api/cameras/debug/ffmpeg
export const getFfmpegDebug = async (req, res) => {
  try {
    // Ejecutamos ps aux filtrando ffmpeg y omitiendo el propio grep
    const rawOutput = await executeRemoteCommand(
      "ps aux | grep ffmpeg | grep -v grep || true"
    );

    const streams = [];

    if (rawOutput && rawOutput.trim() !== "") {
      const lines = rawOutput.split("\n");

      for (let line of lines) {
        const trimmed = line.trim();
        if (trimmed === "" || !trimmed.includes("ffmpeg") || trimmed.includes("grep")) {
          continue;
        }

        const tokens = trimmed.split(/\s+/);
        if (tokens.length < 11) {
          continue;
        }

        const user = tokens[0];
        const pid = tokens[1];
        const cpu = tokens[2];
        const mem = tokens[3];
        const vsz = tokens[4];
        const rss = tokens[5];
        const start = tokens[8];
        const time = tokens[9];
        const command = tokens.slice(10).join(" ");

        // Parseo de argumentos con expresiones regulares
        const deviceMatch = command.match(/-i\s+([^\s]+)/);
        const device = deviceMatch ? deviceMatch[1] : "Desconocido";

        const resolutionMatch = command.match(/-video_size\s+([^\s]+)/);
        const resolution = resolutionMatch ? resolutionMatch[1] : "N/A";

        const fpsMatch = command.match(/-framerate\s+([^\s]+)/);
        const fps = fpsMatch ? fpsMatch[1] : "N/A";

        const bitrateMatch = command.match(/-b:v\s+([^\s]+)/);
        const bitrate = bitrateMatch ? bitrateMatch[1] : "N/A";

        const vaapiMatch = command.match(/-vaapi_device\s+([^\s]+)/);
        const vaapi = vaapiMatch ? vaapiMatch[1] : "N/A";

        const rtspMatch = command.match(/(rtsp:\/\/[^\s]+)/);
        const rtspUrl = rtspMatch ? rtspMatch[1] : "N/A";

        streams.push({
          user,
          pid,
          cpu: parseFloat(cpu) || 0,
          mem: parseFloat(mem) || 0,
          vsz: parseInt(vsz, 10) || 0,
          rss: parseInt(rss, 10) || 0,
          start,
          time,
          device,
          resolution,
          fps,
          bitrate,
          vaapi,
          rtspUrl,
          command,
        });
      }
    }

    res.json({
      status: "success",
      streams,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error consultando procesos FFmpeg",
      details: error.message,
    });
  }
};

// POST /api/cameras/debug/ffmpeg/kill
export const killFfmpegProcess = async (req, res) => {
  const { pid } = req.body;
  const pidNum = parseInt(pid, 10);

  if (isNaN(pidNum) || pidNum <= 0) {
    return res.status(400).json({ error: "El PID provisto es inválido o no existe." });
  }

  try {
    const cmd = `kill -9 ${pidNum}`;
    await executeRemoteCommand(cmd);

    // Sincronizamos activeStreams
    for (let [dev, stream] of activeStreams.entries()) {
      if (stream.pid === pidNum) {
        activeStreams.delete(dev);
      }
    }

    res.json({
      status: "success",
      message: `Proceso con PID ${pidNum} finalizado correctamente en el servidor.`,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error finalizando el proceso de cámara",
      details: error.message,
    });
  }
};

// POST /api/cameras/debug/ffmpeg/kill-all
export const killAllFfmpegProcesses = async (req, res) => {
  try {
    const cmd = 'pkill -9 -f "ffmpeg" || true';
    await executeRemoteCommand(cmd);

    // Sincronizamos activeStreams limpiándolo en su totalidad
    activeStreams.clear();

    res.json({
      status: "success",
      message: "Todas las transmisiones activas han sido detenidas de manera masiva.",
    });
  } catch (error) {
    res.status(500).json({
      error: "Error finalizando todas las transmisiones de cámaras",
      details: error.message,
    });
  }
};


