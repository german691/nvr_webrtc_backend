import sqlite3 from "sqlite3";
import { Client } from "ssh2";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "../nvr.db");

// Cargar credenciales por defecto desde .env si existe
const targetIp = "192.168.1.102";
let sshConfig = {
  host: targetIp,
  port: 22,
  username: "root",
  password: "tecno26",
  readyTimeout: 10000
};

console.log("=== INICIANDO DIAGNÓSTICO DE NODO EDGE ===");
console.log(`Objetivo: ${targetIp}`);

// Intentar leer credenciales desde la base de datos SQLite
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.warn("⚠️ No se pudo abrir la base de datos SQLite directamente:", err.message);
    runDiagnostics(sshConfig);
  } else {
    db.get("SELECT * FROM edge_nodes WHERE ip = ?", [targetIp], (err, row) => {
      db.close();
      if (err) {
        console.warn("⚠️ Error al consultar edge_nodes en la DB:", err.message);
      } else if (row) {
        console.log("ℹ️ Credenciales encontradas en SQLite para este nodo:");
        console.log(`   Usuario: ${row.username}`);
        console.log(`   Puerto: ${row.port}`);
        sshConfig.username = row.username;
        sshConfig.port = row.port;
        sshConfig.password = row.password;
      } else {
        console.log("ℹ️ Nodo no registrado en SQLite. Usando credenciales por defecto (root / tecno26).");
      }
      runDiagnostics(sshConfig);
    });
  }
});

function executeCommand(conn, cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) {
        resolve({ success: false, error: err.message, stdout: "", stderr: "" });
        return;
      }
      let stdout = "";
      let stderr = "";
      stream.on("close", (code) => {
        resolve({ success: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim() });
      });
      stream.on("data", (data) => {
        stdout += data.toString();
      });
      stream.stderr.on("data", (data) => {
        stderr += data.toString();
      });
    });
  });
}

async function runDiagnostics(config) {
  const conn = new Client();
  console.log(`\nConectando a ${config.host}:${config.port} vía SSH como '${config.username}'...`);

  conn.on("ready", async () => {
    console.log("✅ Conexión SSH establecida con éxito!\n");
    console.log("=== EJECUTANDO PRUEBAS DE DIAGNÓSTICO EN EL CLIENTE ===");

    // 1. Verificar versión de Debian/OS
    console.log("\n--- [1/7] Sistema Operativo ---");
    const osCheck = await executeCommand(conn, "cat /etc/os-release | grep -E '^PRETTY_NAME='");
    if (osCheck.success) {
      console.log(`Sistema Operativo: ${osCheck.stdout.replace("PRETTY_NAME=", "").replace(/"/g, "")}`);
    } else {
      console.log("❌ Error al leer /etc/os-release");
    }

    // 2. Verificar ffmpeg
    console.log("\n--- [2/7] Instalación de FFmpeg ---");
    const ffmpegPath = await executeCommand(conn, "which ffmpeg");
    if (ffmpegPath.success) {
      console.log(`✅ ffmpeg encontrado en: ${ffmpegPath.stdout}`);
      const ffmpegVer = await executeCommand(conn, "ffmpeg -version | head -n 1");
      console.log(`   Versión: ${ffmpegVer.stdout}`);
      
      // Verificar si tiene soporte para vaapi
      const ffmpegVaapi = await executeCommand(conn, "ffmpeg -decoders | grep vaapi || true");
      if (ffmpegVaapi.stdout) {
        console.log("   ✅ FFmpeg compilado con decodificadores VAAPI.");
      } else {
        console.log("   ⚠️ FFmpeg no parece listar decodificadores VAAPI. ¿Instalado de repositorios oficiales?");
      }
    } else {
      console.log("❌ FFmpeg NO está instalado o no se encuentra en el PATH!");
      console.log("   Sugerencia: Ejecute 'apt update && apt install -y ffmpeg' en el nodo.");
    }

    // 3. Verificar Dispositivo Gráfico y VAAPI
    console.log("\n--- [3/7] Aceleración Gráfica (VAAPI) ---");
    const renderNode = await executeCommand(conn, "ls -lh /dev/dri/renderD128");
    if (renderNode.success) {
      console.log(`✅ Dispositivo de renderizado gráfico encontrado: ${renderNode.stdout}`);
      // Verificar permisos
      const permissions = await executeCommand(conn, "groups");
      console.log(`   Grupos del usuario actual: ${permissions.stdout}`);
      
      // Ejecutar vainfo
      const vainfo = await executeCommand(conn, "vainfo");
      if (vainfo.success) {
        console.log("✅ vainfo cargado correctamente. Aceleración VAAPI lista!");
        console.log(vainfo.stdout);
        
        // Verificar específicamente soporte para codificación H264
        const hasH264Enc = vainfo.stdout.includes("VAEntrypointEncPicture") && 
                           (vainfo.stdout.includes("VAProfileH264") || vainfo.stdout.includes("VAProfileAVC"));
        if (hasH264Enc) {
          console.log("   ✅ VA-API soporta codificación por hardware H264 (VAEntrypointEncPicture).");
        } else {
          console.log("   ❌ VA-API NO soporta codificación H264 en esta GPU AMD!");
          console.log("      Sugerencia: Algunas GPUs AMD antiguas o ciertos drivers no exponen codificación H264 VAAPI. Podría ser necesario usar codificación por software (libx264).");
        }
      } else {
        console.log("❌ vainfo reportó errores o no está instalado.");
        console.log(`   stderr: ${vainfo.stderr}`);
        console.log("   Sugerencia: Instale 'vainfo' y los controladores necesarios para el procesador (intel-media-driver o mesa-va-drivers).");
      }
    } else {
      console.log("❌ Dispositivo /dev/dri/renderD128 NO encontrado!");
      console.log("   ¿Este hardware cuenta con GPU integrada (Intel/AMD) habilitada en BIOS?");
      console.log("   Si es una máquina virtual, asegúrese de tener habilitado el passthrough gráfico.");
    }

    // 4. Verificar Cámaras Conectadas (V4L2 / USB)
    console.log("\n--- [4/7] Dispositivos de Captura (Cámaras) ---");
    const videoDevs = await executeCommand(conn, "ls -l /dev/video* || true");
    if (videoDevs.stdout) {
      console.log("Dispositivos de video detectados:");
      console.log(videoDevs.stdout);
      
      const v4l2Check = await executeCommand(conn, "which v4l2-ctl");
      if (v4l2Check.success) {
        const v4l2List = await executeCommand(conn, "v4l2-ctl --list-devices");
        console.log("\nDetalle de dispositivos V4L2:");
        console.log(v4l2List.stdout);
      } else {
        console.log("⚠️ 'v4l2-ctl' no está instalado. No podemos detallar las marcas.");
        console.log("   Sugerencia: 'apt install -y v4l-utils' para habilitar herramientas de diagnóstico.");
      }
    } else {
      console.log("❌ NO se detectaron dispositivos de cámara en /dev/video*!");
      console.log("   ¿Están las cámaras USB conectadas físicamente a la segunda PC?");
    }

    // 5. Verificar MediaMTX (Servidor RTSP/WebRTC)
    console.log("\n--- [5/7] Servidor de Streaming (MediaMTX) ---");
    const pmtx = await executeCommand(conn, "ps aux | grep -i mediamtx | grep -v grep || true");
    if (pmtx.stdout) {
      console.log(`✅ MediaMTX se está ejecutando!`);
      console.log(`   Proceso: ${pmtx.stdout}`);
      
      // Verificar puertos abiertos
      const ports = await executeCommand(conn, "ss -tlnp | grep -E '8554|8889' || true");
      if (ports.stdout) {
        console.log("   Puertos activos:");
        console.log(ports.stdout);
      } else {
        console.log("   ⚠️ MediaMTX está en ejecución pero los puertos de transmisión (8554 o 8889) no parecen estar abiertos.");
      }
    } else {
      console.log("❌ MediaMTX NO se está ejecutando en el nodo!");
      console.log("   El NVR requiere que MediaMTX esté en ejecución en cada nodo para recibir el flujo RTSP y exponer la URL WebRTC.");
      console.log("   Sugerencia: Inicie el servicio de mediamtx o el ejecutable correspondiente.");
    }

    // 6. Verificar Script de Capacidades de Cámara
    console.log("\n--- [6/7] Script de Capacidades NVR ---");
    const scriptCheck = await executeCommand(conn, "ls -lh /usr/local/bin/get_capabilities.sh");
    if (scriptCheck.success) {
      console.log(`✅ Script de capacidades encontrado: ${scriptCheck.stdout}`);
      
      // Probar ejecución del script
      console.log("   Ejecutando script de capacidades...");
      const scriptRun = await executeCommand(conn, "/usr/local/bin/get_capabilities.sh");
      if (scriptRun.success) {
        console.log("   ✅ Capacidades JSON leídas con éxito!");
        try {
          const parsed = JSON.parse(scriptRun.stdout);
          console.log(`   Se detectaron ${parsed.length} cámara(s) formateada(s) correctamente.`);
          console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log("   ❌ El script no devolvió un formato JSON válido!");
          console.log(`   Salida: ${scriptRun.stdout}`);
        }
      } else {
        console.log("   ❌ Error al ejecutar el script!");
        console.log(`   stderr: ${scriptRun.stderr}`);
      }
    } else {
      console.log("❌ Script /usr/local/bin/get_capabilities.sh NO encontrado!");
      console.log("   Este script es fundamental para que el NVR consulte qué cámaras hay conectadas y qué resoluciones/FPS soportan.");
      console.log("   Sugerencia: Copie el archivo 'get_capabilities.sh' del nodo principal al directorio '/usr/local/bin/' en el segundo nodo y otórguele permisos de ejecución (chmod +x).");
    }

    // 7. Prueba de Ejecución ffmpeg manual simulada
    console.log("\n--- [7/7] Prueba de Lanzamiento de Captura FFmpeg ---");
    // Buscamos un dispositivo de video válido
    const firstVideoDevCheck = await executeCommand(conn, "ls /dev/video0 || true");
    if (firstVideoDevCheck.stdout === "/dev/video0") {
      console.log("Haciendo prueba de transcodificación de 3 segundos en /dev/video0 usando VAAPI...");
      const testFfmpeg = await executeCommand(conn, 
        "timeout 3 /usr/bin/ffmpeg -hide_banner -vaapi_device /dev/dri/renderD128 -f v4l2 -input_format mjpeg -video_size 640x480 -framerate 30 -i /dev/video0 -vf 'format=nv12,hwupload' -c:v h264_vaapi -bf 0 -f null - || true"
      );
      if (testFfmpeg.stderr && testFfmpeg.stderr.includes("Error")) {
        console.log("❌ FFmpeg falló con errores!");
        console.log(testFfmpeg.stderr);
      } else {
        console.log("✅ FFmpeg funcionó de forma fluida con aceleración VAAPI!");
      }
    } else {
      console.log("Omitiendo prueba de lanzamiento de FFmpeg debido a la ausencia de /dev/video0.");
    }

    console.log("\n=== DIAGNÓSTICO COMPLETADO ===");
    conn.end();
  }).on("error", (err) => {
    console.error("\n❌ ERROR DE CONEXIÓN SSH:");
    console.error(`   No se pudo establecer conexión con ${config.host} en el puerto ${config.port}.`);
    console.log(`   Mensaje: ${err.message}`);
    console.log("\nPosibles causas:");
    console.log("1. La IP 192.168.1.102 es incorrecta o la PC está apagada.");
    console.log("2. El servicio SSH (sshd) no está instalado o activo en el nodo Debian 13 ('systemctl status ssh').");
    console.log("3. Cortafuegos (ufw/iptables) bloqueando el puerto 22.");
    console.log("4. Credenciales incorrectas. (¿Usuario es 'root' y contraseña es 'tecno26'?)");
    console.log("5. Debian 13 restringe el acceso SSH root por defecto. Verifique '/etc/ssh/sshd_config' y asegúrese de que 'PermitRootLogin yes' esté habilitado, luego reinicie el servicio ('systemctl restart ssh').");
  }).connect(config);
}
