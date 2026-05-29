import { activeStreams } from "./camera.helper.js";
import { DEBUG_MODE } from "../config/env.config.js";
import {
  MOCK_CAMERAS,
  DEFAULT_UVC_CONTROLS,
  USEFUL_UVC_CONTROLS,
} from "../config/camera.constants.js";
import { parseFfmpegProcesses } from "../utils/ffmpegParser.js";
import { getEdgeNodesFromDb } from "../config/db.js";
import { CameraRepository } from "./camera.repository.js";
import { activeAgents, sendCommandToAgent } from "../config/websocket.js";

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
export const syncActiveStreamsWithHost = async (targetNodeIp = null) => {
  if (DEBUG_MODE) return;
  try {
    let nodes = await getEdgeNodesFromDb();
    if (targetNodeIp) {
      nodes = nodes.filter((n) => n.ip === targetNodeIp);
    }
    const foundDevices = new Set();

    await Promise.all(
      nodes.map(async (node) => {
        try {
          // Si el agente no está conectado por WebSocket, omitimos la sincronización
          if (!activeAgents.has(node.ip)) return;

          const activeProcesses = await sendCommandToAgent(node.ip, "get_active_streams");

          for (let proc of activeProcesses) {
            if (proc.device) {
              const devKey = `${node.ip}:${proc.device}`;
              foundDevices.add(devKey);
              activeStreams.set(devKey, {
                pid: proc.pid,
                resolution: proc.resolution,
                fps: proc.fps,
                bitrate: proc.bitrate,
              });
            }
          }
        } catch (err) {
          console.error(`Error al sincronizar activeStreams con el agente ${node.ip}:`, err.message);
        }
      })
    );

    // Eliminamos de activeStreams cualquier dispositivo que ya no tenga proceso activo
    for (let devKey of activeStreams.keys()) {
      const [hostIp] = devKey.split(":");
      if (targetNodeIp) {
        if (hostIp === targetNodeIp && !foundDevices.has(devKey)) {
          activeStreams.delete(devKey);
        }
      } else {
        if (!foundDevices.has(devKey)) {
          activeStreams.delete(devKey);
        }
      }
    }
  } catch (error) {
    console.error("Error al sincronizar activeStreams con los agentes:", error.message);
  }
};

/**
 * GET /api/cameras
 * Obtiene el listado de cámaras activas en el sistema, detectando capacidades y estados de stream activos.
 */
export const getCameras = async (req, res) => {
  const { nodeIp } = req.query;

  try {
    let nodes = [];
    try {
      nodes = await getEdgeNodesFromDb();
    } catch (err) {
      if (DEBUG_MODE) {
        nodes = [{ ip: "192.168.1.101", label: "Nodo Principal" }, { ip: "192.168.1.102", label: "Nodo Secundario" }];
      } else {
        throw err;
      }
    }
    if (nodes.length === 0 && DEBUG_MODE) {
      nodes = [{ ip: "192.168.1.101", label: "Nodo Principal" }, { ip: "192.168.1.102", label: "Nodo Secundario" }];
    }

    // SI NO hay nodeIp, devolvemos INSTANTÁNEAMENTE la lista de nodos desde la DB (o mocks)
    if (!nodeIp) {
      const nodeList = nodes.map((node) => ({
        ip: node.ip,
        label: node.label || `Nodo ${node.ip}`,
        isNode: true,
      }));
      return res.json(nodeList);
    }

    // SI HAY nodeIp, consultamos SOLO ese nodo
    const node = nodes.find((n) => n.ip === nodeIp);
    if (!node) {
      return res.status(404).json({ error: `Nodo con IP ${nodeIp} no configurado.` });
    }

    if (DEBUG_MODE) {
      const nodeIndex = nodes.findIndex((n) => n.ip === nodeIp);
      const labelsMap = await CameraRepository.getAllLabels(node.ip);
      const response = MOCK_CAMERAS.filter((cam, idx) => idx % nodes.length === nodeIndex)
        .map((cam) => {
          const devKey = `${node.ip}:${cam.dev}`;
          const streamPath = cam.dev.replace("/dev/", "");
          const activeStream = activeStreams.get(devKey);

          // Generar una ruta física persistente simulada (mock)
          const mockPersistentPath = `/dev/v4l/by-path/mock-usb-port-${cam.dev.replace("/dev/video", "")}`;
          const savedLabel = labelsMap[mockPersistentPath];

          return {
            dev: devKey,
            persistent_path: mockPersistentPath,
            name: savedLabel ? `${savedLabel} (${node.label || node.ip})` : `${cam.name} (${node.label || node.ip})`,
            modes: cam.modes,
            streaming: !!activeStream,
            webrtc_url: activeStream ? `mock://${node.ip}:8889/${streamPath}` : null,
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

    // Sincronizamos dinámicamente con los procesos reales en el host remoto específico
    await syncActiveStreamsWithHost(node.ip);

    const response = [];
    try {
      // Si el agente no está conectado por WebSocket, devolvemos error de "Mini-PC fuera de línea"
      if (!activeAgents.has(node.ip)) {
        return res.status(503).json({
          error: `⚠️ Mini-PC fuera de línea (${node.ip})`,
          details: "El agente de la Mini-PC no está conectado al servidor WebSocket.",
        });
      }

      // 1. Obtener las capacidades de las cámaras directamente del agente en tiempo real
      const validCameras = await sendCommandToAgent(node.ip, "get_capabilities");

      // 2. Traer todos los rótulos guardados para este nodo
      const labelsMap = await CameraRepository.getAllLabels(node.ip);

      for (const cam of validCameras) {
        const devKey = `${node.ip}:${cam.dev}`;
        const streamPath = cam.dev.replace("/dev/", "");
        const activeStream = activeStreams.get(devKey);

        // Obtener la ruta física persistente USB de la cámara
        const persistentPath = cam.persistent_path || cam.dev;
        const savedLabel = labelsMap[persistentPath];

        // Rótulo amigable o nombre del hardware por defecto
        const finalName = savedLabel 
          ? `${savedLabel} (${node.label || node.ip})`
          : `${cam.name} (${node.label || node.ip})`;

        response.push({
          dev: devKey,
          persistent_path: persistentPath,
          name: finalName,
          modes: cam.modes,
          streaming: !!activeStream,
          webrtc_url: activeStream
            ? `http://${node.ip}:8889/${streamPath}`
            : null,
          active_settings: activeStream
            ? {
                resolution: activeStream.resolution,
                fps: activeStream.fps,
                bitrate: activeStream.bitrate,
              }
            : null,
        });
      }
    } catch (err) {
      console.error(`Error de conexión con el agente del nodo ${node.label || node.ip}:`, err.message);
      return res.status(503).json({
        error: `Error de conexión con el agente del nodo ${node.label || node.ip}`,
        details: err.message,
      });
    }

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

  // Extraemos host y dispositivo real
  const [host, realDev] = dev.includes(":") ? dev.split(":") : [null, dev];

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
      const streamPath = realDev.replace("/dev/", "");
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
        webrtc_url: `mock://${host || "localhost"}:8889/${streamPath}`,
        active_settings: {
          resolution,
          fps,
          bitrate: cleanBitrate,
          data: `[MOCK] ffmpeg -hide_banner -vaapi_device /dev/dri/renderD128 -f v4l2 -video_size ${resolution} -framerate ${fps} -i ${realDev} -f rtsp rtsp://localhost:8554/${streamPath}`,
        },
      });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Error simulando hardware", details: error.message });
    }
  }

  try {
    const nodes = await getEdgeNodesFromDb();
    const node = nodes.find((n) => n.ip === host) || nodes[0];
    if (!node) {
      throw new Error(`Nodo no configurado para el host: ${host}`);
    }

    if (!activeAgents.has(node.ip)) {
      return res.status(503).json({
        error: `⚠️ Mini-PC fuera de línea (${node.ip})`,
        details: "No se pueden controlar transmisiones si la Mini-PC está desconectada.",
      });
    }

    if (action === "stop") {
      await sendCommandToAgent(node.ip, "control_stream", {
        action: "stop",
        dev: realDev
      });
      activeStreams.delete(dev);

      return res.json({
        status: "success",
        message: `Cámara ${dev} liberada.`,
      });
    }

    const streamPath = realDev.replace("/dev/", "");
    const result = await sendCommandToAgent(node.ip, "control_stream", {
      action: "start",
      dev: realDev,
      resolution,
      fps,
      cleanBitrate,
      streamPath
    });

    const pidNum = parseInt(result.pid, 10);

    if (isNaN(pidNum)) {
      throw new Error("Fallo al obtener PID del proceso de captura desde el agente");
    }

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
      webrtc_url: `http://${node.ip}:8889/${streamPath}`,
      active_settings: {
        resolution,
        fps,
        bitrate: cleanBitrate,
        data: result.command_executed,
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

  // Extraemos host y dispositivo real
  const [host, realDev] = dev.includes(":") ? dev.split(":") : [null, dev];

  if (!realDev || !/^\/dev\/(video|cam)[a-zA-Z0-9_]+$/.test(realDev)) {
    return res.status(400).json({ error: "Dispositivo 'dev' inválido" });
  }

  if (DEBUG_MODE) {
    const controls = getMockControls(dev);
    return res.json({ status: "success", dev, controls });
  }

  try {
    const nodes = await getEdgeNodesFromDb();
    const node = nodes.find((n) => n.ip === host) || nodes[0];
    if (!node) {
      throw new Error(`Nodo no configurado para el host: ${host}`);
    }

    if (!activeAgents.has(node.ip)) {
      return res.status(503).json({
        error: `⚠️ Mini-PC fuera de línea (${node.ip})`,
        details: "No se pueden obtener controles si la Mini-PC está desconectada.",
      });
    }

    const controls = await sendCommandToAgent(node.ip, "get_uvc_controls", {
      dev: realDev,
    });

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

  // Extraemos host y dispositivo real
  const [host, realDev] = dev.includes(":") ? dev.split(":") : [null, dev];

  if (DEBUG_MODE) {
    const key = `${dev}:${controlName}`;
    mockControlsValues.set(key, parseInt(value, 10));
    return res.json({
      status: "success",
      message: `[MOCK] Control ${controlName} ajustado a ${value}`,
    });
  }

  try {
    const nodes = await getEdgeNodesFromDb();
    const node = nodes.find((n) => n.ip === host) || nodes[0];
    if (!node) {
      throw new Error(`Nodo no configurado para el host: ${host}`);
    }

    if (!activeAgents.has(node.ip)) {
      return res.status(503).json({
        error: `⚠️ Mini-PC fuera de línea (${node.ip})`,
        details: "No se pueden ajustar controles si la Mini-PC está desconectada.",
      });
    }

    await sendCommandToAgent(node.ip, "set_uvc_control", {
      dev: realDev,
      controlName,
      value,
    });

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
      const [host, realDev] = dev.includes(":") ? dev.split(":") : ["localhost", dev];
      const mockCpu = (12 + Math.random() * 10).toFixed(1);
      const mockMem = (1.5 + Math.random() * 1.0).toFixed(1);
      const mockRss = Math.floor(40000 + Math.random() * 8000);
      const streamPath = realDev.replace("/dev/", "");

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
        rtspUrl: `rtsp://${host}:8554/${streamPath}`,
        command: `/usr/bin/ffmpeg -hide_banner -vaapi_device /dev/dri/renderD128 -f v4l2 -input_format mjpeg -video_size ${stream.resolution} -framerate ${stream.fps} -i ${realDev} -vf format=nv12,hwupload -c:v h264_vaapi -bf 0 -b:v ${stream.bitrate} -f rtsp rtsp://localhost:8554/${streamPath}`,
      });
    }
    return res.json({
      status: "success",
      streams,
    });
  }

  try {
    const nodes = await getEdgeNodesFromDb();
    const allStreams = [];

    await Promise.all(
      nodes.map(async (node) => {
        try {
          if (!activeAgents.has(node.ip)) return;

          const streams = await sendCommandToAgent(node.ip, "get_ffmpeg_debug");
          for (let stream of streams) {
            if (stream.device) {
              allStreams.push({
                ...stream,
                device: `${node.ip}:${stream.device}`,
                rtspUrl: `rtsp://${node.ip}:8554/${stream.device.replace("/dev/", "")}`,
              });
            }
          }
        } catch (err) {
          console.error(`Error al obtener depuración del agente ${node.ip}:`, err.message);
        }
      })
    );

    res.json({
      status: "success",
      streams: allStreams,
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
    const nodes = await getEdgeNodesFromDb();
    let targetNodeIp = null;

    for (let [devKey, stream] of activeStreams.entries()) {
      if (stream.pid === pidNum) {
        const [host] = devKey.split(":");
        targetNodeIp = host;
        break;
      }
    }

    if (targetNodeIp && activeAgents.has(targetNodeIp)) {
      await sendCommandToAgent(targetNodeIp, "kill_ffmpeg", { pid: pidNum });
    } else {
      // Fallback a todos los agentes conectados
      await Promise.all(
        nodes.map(async (node) => {
          try {
            if (activeAgents.has(node.ip)) {
              await sendCommandToAgent(node.ip, "kill_ffmpeg", { pid: pidNum });
            }
          } catch (err) {
            // Ignoramos errores individuales
          }
        })
      );
    }

    for (let [devKey, stream] of activeStreams.entries()) {
      if (stream.pid === pidNum) {
        activeStreams.delete(devKey);
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
    const nodes = await getEdgeNodesFromDb();

    await Promise.all(
      nodes.map(async (node) => {
        try {
          if (activeAgents.has(node.ip)) {
            await sendCommandToAgent(node.ip, "kill_all_ffmpeg");
          }
        } catch (err) {
          console.error(`Error al detener procesos en el agente ${node.ip}:`, err.message);
        }
      })
    );

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

/**
 * POST /api/cameras/label
 * Guarda o actualiza un rótulo amigable permanente para un puerto USB físico de cámara.
 */
export const saveCameraLabel = async (req, res) => {
  const { nodeIp, persistentPath, customName } = req.body;

  if (!nodeIp || !persistentPath || customName === undefined) {
    return res
      .status(400)
      .json({ error: "Faltan parámetros requeridos (nodeIp, persistentPath, customName)" });
  }

  try {
    const result = await CameraRepository.saveLabel(nodeIp, persistentPath, customName);
    res.json({
      status: "success",
      message: "Rótulo de cámara guardado con éxito.",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      error: "Fallo al guardar el rótulo en la base de datos.",
      details: error.message,
    });
  }
};
