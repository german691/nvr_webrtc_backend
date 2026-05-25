/**
 * Utilidades para el procesamiento de resultados de terminal y expresiones regulares de FFmpeg
 */

/**
 * Procesa una línea individual de 'ps aux' buscando coincidencia con un proceso FFmpeg de captura válido.
 * @param {string} line Línea cruda del comando de terminal
 * @returns {object|null} Objeto estructurado del proceso o null si no es un proceso de cámara válido
 */
export function parseFfmpegProcessLine(line) {
  const trimmed = line.trim();
  if (trimmed === "" || !trimmed.includes("ffmpeg") || trimmed.includes("grep")) {
    return null;
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 11) {
    return null;
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
  const device = deviceMatch ? deviceMatch[1] : null;

  // Filtrar si el dispositivo de entrada no coincide con una ruta del sistema (/dev/video o similar)
  if (!device || !device.startsWith("/dev/")) {
    return null;
  }

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

  return {
    user,
    pid: parseInt(pid, 10),
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
  };
}

/**
 * Divide la respuesta completa de terminal en líneas y procesa cada proceso de FFmpeg.
 * @param {string} rawOutput Texto crudo completo del comando ps aux
 * @returns {Array<object>} Listado de transmisiones activas y parseadas de manera segura
 */
export function parseFfmpegProcesses(rawOutput) {
  const streams = [];
  if (!rawOutput || rawOutput.trim() === "") {
    return streams;
  }

  const lines = rawOutput.split("\n");
  for (let line of lines) {
    const parsed = parseFfmpegProcessLine(line);
    if (parsed) {
      streams.push(parsed);
    }
  }

  return streams;
}
