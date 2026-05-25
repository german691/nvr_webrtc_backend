import { executeRemoteCommand, activeStreams } from "./camera.helper.js";
import { EDGE_HOST, DEBUG_MODE } from "../config/env.config.js";
import {
  MOCK_CAMERAS,
  DEFAULT_UVC_CONTROLS,
  USEFUL_UVC_CONTROLS,
} from "../config/camera.constants.js";
import { parseFfmpegProcesses } from "../utils/ffmpegParser.js";

// Almacén en memoria persistente para controles UVC ficticios en modo depuración
export const mockControlsValues = new Map();

/**
 * Obtiene la configuración de controles simulada de una cámara en modo debug.
 * @param {string} dev Ruta del dispositivo de video
 * @returns {Array<object>} Controles de la cámara con sus valores simulados activos
 */
const getMockControls = (dev) => {
  return DEFAULT_UVC_CONTROLS.map((ctrl) => {
    const key = `${dev}:${ctrl.name}`;
    if (!mockControlsValues.has(key)) {
      mockControlsValues.set(key, ctrl.default);
    }
    return {
      ...ctrl,
      value: mockControlsValues.get(key),
    };
  });
};

/**
 * Sincroniza el mapa activeStreams en memoria con los procesos FFmpeg reales en el host remoto.
 */
export const syncActiveStreamsWithHost = async () => {
  if (DEBUG_MODE) return;
  try {
    const rawOutput = await executeRemoteCommand(
      "ps aux | grep ffmpeg | grep -v grep || true"
    );

    const activeProcesses = parseFfmpegProcesses(rawOutput);
    const foundDevices = new Set();

    for (let proc of activeProcesses) {
      if (proc.device) {
        foundDevices.add(proc.device);
        activeStreams.set(proc.device, {
          pid: proc.pid,
          resolution: proc.resolution,
          fps: proc.fps,
          bitrate: proc.bitrate,
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

/**
 * GET /api/cameras
 * Obtiene el listado de cámaras activas en el sistema, detectando capacidades y estados de stream activos.
 */
export const getCameras = async (req, res) => {
  try {
    if (DEBUG_MODE) {
      const response = MOCK_CAMERAS.map((cam) => {
        const streamPath = cam.dev.replace("/dev/", "");
        const activeStream = activeStreams.get(cam.dev);

        return {
          dev: cam.dev,
          name: cam.name,
          modes: cam.modes,
          streaming: !!activeStream,
          webrtc_url: activeStream ? `mock://${streamPath}` : null,
          active_settings: activeStream
            ? {
                resolution: activeStream.resolution,
                fps: activeStream.fps,
                bitrate: activeStream.bitrate,
              }
            : null,
        };
      });

      return res.json(response);
    }

    // Sincronizamos dinámicamente con los procesos reales en el host remoto
    await syncActiveStreamsWithHost();

    const rawJson = await executeRemoteCommand(
      "/usr/local/bin/get_capabilities.sh"
    );
    const cameras = JSON.parse(rawJson);

    const validCameras = cameras.filter(
      (cam) => cam.modes && cam.modes.length > 0
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

/**
 * POST /api/cameras/stream
 * Controla e inicia/detiene el hardware de captura y transcodificación FFmpeg en el host remoto.
 */
export const controlStream = async (req, res) => {
  const { dev, resolution, fps, cleanBitrate, action } = req.body;

  if (DEBUG_MODE) {
    try {
      if (action === "stop") {
        activeStreams.delete(dev);
        return res.json({
          status: "success",
          message: `[MOCK] Cámara ${dev} liberada.`,
        });
      }

      activeStreams.delete(dev);
      const streamPath = dev.replace("/dev/", "");
      const mockPid = Math.floor(Math.random() * 10000) + 5000;

      activeStreams.set(dev, {
        pid: mockPid,
        resolution,
        fps,
        bitrate: cleanBitrate,
      });

      return res.json({
        status: "success",
        message: `[MOCK] Hardware activado a ${resolution} @ ${fps} FPS.`,
        pid: mockPid,
        webrtc_url: `mock://${streamPath}`,
        active_settings: {
          resolution,
          fps,
          bitrate: cleanBitrate,
          data: `[MOCK] ffmpeg -hide_banner -vaapi_device /dev/dri/renderD128 -f v4l2 -video_size ${resolution} -framerate ${fps} -i ${dev} -f rtsp rtsp://localhost:8554/${streamPath}`,
        },
      });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Error simulando hardware", details: error.message });
    }
  }

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

/**
 * GET /api/cameras/controls?dev=/dev/video0
 * Lista los controles de hardware UVC configurables para un dispositivo de video en particular.
 */
export const getCameraControls = async (req, res) => {
  const { dev } = req.query;

  if (!dev || !/^\/dev\/(video|cam)[a-zA-Z0-9_]+$/.test(dev)) {
    return res.status(400).json({ error: "Dispositivo 'dev' inválido" });
  }

  if (DEBUG_MODE) {
    const controls = getMockControls(dev);
    return res.json({ status: "success", dev, controls });
  }

  try {
    // Consultamos los controles nativos directamente al hardware
    const rawOutput = await executeRemoteCommand(
      `v4l2-ctl -d ${dev} --list-ctrls`
    );

    const controls = [];
    const lines = rawOutput.split("\n");

    for (let line of lines) {
      // Parseamos la salida de v4l2-ctl mediante Expresiones Regulares
      // Ejemplo: "brightness 0x00980900 (int)    : min=0 max=255 step=1 default=128 value=128"
      const match = line.match(
        /^\s*([a-zA-Z0-9_]+).*?\((int|bool|menu)\)\s*:\s*(.*)$/
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
        if (USEFUL_UVC_CONTROLS.includes(name)) {
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

/**
 * POST /api/cameras/controls
 * Ajusta y aplica el valor de un control UVC nativo al hardware físico.
 */
export const setCameraControl = async (req, res) => {
  const { dev, controlName, value } = req.body;

  if (!dev || !controlName || value === undefined) {
    return res
      .status(400)
      .json({ error: "Faltan parámetros (dev, controlName, value)" });
  }

  if (DEBUG_MODE) {
    const key = `${dev}:${controlName}`;
    mockControlsValues.set(key, parseInt(value, 10));
    return res.json({
      status: "success",
      message: `[MOCK] Control ${controlName} ajustado a ${value}`,
    });
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

/**
 * GET /api/cameras/debug/ffmpeg
 * Devuelve información de depuración de rendimiento y diagnóstico en tiempo real de los procesos FFmpeg activos.
 */
export const getFfmpegDebug = async (req, res) => {
  if (DEBUG_MODE) {
    const streams = [];
    for (const [dev, stream] of activeStreams.entries()) {
      const mockCpu = (12 + Math.random() * 10).toFixed(1);
      const mockMem = (1.5 + Math.random() * 1.0).toFixed(1);
      const mockRss = Math.floor(40000 + Math.random() * 8000);
      const streamPath = dev.replace("/dev/", "");

      streams.push({
        user: "root",
        pid: String(stream.pid),
        cpu: parseFloat(mockCpu),
        mem: parseFloat(mockMem),
        vsz: 184500,
        rss: mockRss,
        start: "10:15",
        time: "0:30",
        device: dev,
        resolution: stream.resolution,
        fps: stream.fps,
        bitrate: stream.bitrate,
        vaapi: "/dev/dri/renderD128",
        rtspUrl: `rtsp://localhost:8554/${streamPath}`,
        command: `/usr/bin/ffmpeg -hide_banner -vaapi_device /dev/dri/renderD128 -f v4l2 -input_format mjpeg -video_size ${stream.resolution} -framerate ${stream.fps} -i ${dev} -vf format=nv12,hwupload -c:v h264_vaapi -bf 0 -b:v ${stream.bitrate} -f rtsp rtsp://localhost:8554/${streamPath}`,
      });
    }
    return res.json({
      status: "success",
      streams,
    });
  }

  try {
    // Ejecutamos ps aux filtrando ffmpeg y omitiendo el propio grep
    const rawOutput = await executeRemoteCommand(
      "ps aux | grep ffmpeg | grep -v grep || true"
    );

    const streams = parseFfmpegProcesses(rawOutput);

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

/**
 * POST /api/cameras/debug/ffmpeg/kill
 * Termina de manera forzosa un proceso FFmpeg particular por su PID.
 */
export const killFfmpegProcess = async (req, res) => {
  const { pid } = req.body;
  const pidNum = parseInt(pid, 10);

  if (isNaN(pidNum) || pidNum <= 0) {
    return res
      .status(400)
      .json({ error: "El PID provisto es inválido o no existe." });
  }

  if (DEBUG_MODE) {
    for (let [dev, stream] of activeStreams.entries()) {
      if (stream.pid === pidNum) {
        activeStreams.delete(dev);
      }
    }
    return res.json({
      status: "success",
      message: `[MOCK] Proceso con PID ${pidNum} finalizado correctamente en el servidor.`,
    });
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

/**
 * POST /api/cameras/debug/ffmpeg/kill-all
 * Detiene y limpia de manera masiva todas las transmisiones activas y procesos FFmpeg remotos.
 */
export const killAllFfmpegProcesses = async (req, res) => {
  if (DEBUG_MODE) {
    activeStreams.clear();
    return res.json({
      status: "success",
      message:
        "[MOCK] Todas las transmisiones activas han sido detenidas de manera masiva.",
    });
  }

  try {
    const cmd = 'pkill -9 -f "ffmpeg" || true';
    await executeRemoteCommand(cmd);

    // Sincronizamos activeStreams limpiándolo en su totalidad
    activeStreams.clear();

    res.json({
      status: "success",
      message:
        "Todas las transmisiones activas han sido detenidas de manera masiva.",
    });
  } catch (error) {
    res.status(500).json({
      error: "Error finalizando todas las transmisiones de cámaras",
      details: error.message,
    });
  }
};
