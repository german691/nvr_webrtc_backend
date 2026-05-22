export const validateStreamRequest = (req, res, next) => {
  const { dev, resolution, fps, bitrate, action } = req.body;
  console.log("=> [NVR-ORQUESTADOR] Petición entrante en /stream:", req.body);

  // 1. Validación de Dispositivo (Obligatorio para cualquier acción)
  if (!dev) return res.status(400).json({ error: 'Falta "dev"' });

  if (!/^\/dev\/video[0-9]+$/.test(dev)) {
    return res
      .status(400)
      .json({ error: "Dispositivo 'dev' inválido. Debe ser /dev/videoX" });
  }

  // Si la acción es detener, dejamos pasar la request
  if (action === "stop") {
    return next();
  }

  // 2. Validación de Codificación (Obligatorio para encender)
  if (!resolution || !fps) {
    return res
      .status(400)
      .json({ error: "Faltan parámetros de codificación (resolution, fps)" });
  }

  if (!/^[0-9]+x[0-9]+$/.test(resolution)) {
    return res.status(400).json({
      error:
        "Resolución inválida. Debe tener el formato ANCHOxALTO (ej: 1280x720)",
    });
  }

  if (!/^[0-9]+$/.test(fps)) {
    return res
      .status(400)
      .json({ error: "FPS inválido. Debe ser un número entero" });
  }

  // 3. Validación de Bitrate (Opcional)
  if (bitrate) {
    let cleanBitrate = String(bitrate).trim();
    if (/^[0-9]+$/.test(cleanBitrate)) {
      cleanBitrate = `${cleanBitrate}k`; // Asumimos kbps si es numérico puro
    }
    if (!/^[0-9]+[kKmMgG]$/.test(cleanBitrate)) {
      return res.status(400).json({
        error:
          "Formato de bitrate inválido. Ejemplos válidos: '2000' (kbps), '2000k', '2M'",
      });
    }
    // Inyectamos el valor limpio en el body para que el controlador lo use
    req.body.cleanBitrate = cleanBitrate;
  }

  next();
};
