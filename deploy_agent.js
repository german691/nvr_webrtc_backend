import { Client } from "ssh2";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nodes = [
  { host: "192.168.1.101", username: "root", password: "tecno26", port: 22 },
  { host: "192.168.1.102", username: "root", password: "tecno26", port: 22 }
];

const agentCode = fs.readFileSync(path.join(__dirname, "nvr_agent.py"), "utf8");

function runRemoteCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = "";
      let stderr = "";
      stream.on("data", (data) => { stdout += data.toString(); });
      stream.stderr.on("data", (data) => { stderr += data.toString(); });
      stream.on("close", (code) => {
        resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
      });
    });
  });
}

function deployToNode(node) {
  return new Promise((resolve) => {
    console.log(`\n=== Iniciando despliegue en Mini-PC: ${node.host} ===`);
    const conn = new Client();
    
    conn.on("ready", async () => {
      console.log(`[${node.host}] SSH conectado exitosamente.`);
      try {
        // 1. Detectar la IP del Host Central desde el punto de vista de la Mini-PC
        console.log(`[${node.host}] Detectando dirección IP de retorno del Servidor Central...`);
        const ipCheck = await runRemoteCommand(conn, "echo $SSH_CLIENT");
        let serverIp = "192.168.1.100"; // Fallback por defecto
        if (ipCheck.stdout) {
          const clientIp = ipCheck.stdout.split(" ")[0];
          if (clientIp && clientIp !== "") {
            serverIp = clientIp;
          }
        }
        console.log(`[${node.host}] IP del Servidor Central detectada: ${serverIp}`);

        // 2. Instalar dependencias necesarias
        console.log(`[${node.host}] Instalando python3-websockets (esto puede demorar unos segundos)...`);
        const aptResult = await runRemoteCommand(conn, "apt-get update && apt-get install -y python3-websockets");
        if (aptResult.code !== 0) {
          console.warn(`[${node.host}] Advertencia al instalar dependencias: ${aptResult.stderr}`);
        } else {
          console.log(`[${node.host}] Dependencias de Python instaladas con éxito.`);
        }

        // 3. Escribir nvr_agent.py en /usr/local/bin
        console.log(`[${node.host}] Escribiendo código de agente en /usr/local/bin/nvr_agent.py...`);
        // Escapar comillas simples para pasarlo seguro en echo
        const escapedCode = agentCode.replace(/'/g, "'\\''");
        await runRemoteCommand(conn, `echo '${escapedCode}' > /usr/local/bin/nvr_agent.py`);
        await runRemoteCommand(conn, "chmod +x /usr/local/bin/nvr_agent.py");

        // 4. Crear el servicio systemd
        console.log(`[${node.host}] Creando archivo de servicio systemd...`);
        const serviceContent = `[Unit]
Description=NVR USB WebRTC Edge Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 -u /usr/local/bin/nvr_agent.py --server ${serverIp} --port 80
Restart=always
RestartSec=5
User=root
WorkingDirectory=/usr/local/bin

[Install]
WantedBy=multi-user.target
`;
        const escapedService = serviceContent.replace(/'/g, "'\\''");
        await runRemoteCommand(conn, `echo '${escapedService}' > /etc/systemd/system/nvr-agent.service`);

        // 5. Recargar systemd y arrancar el servicio
        console.log(`[${node.host}] Habilitando e iniciando servicio nvr-agent.service...`);
        await runRemoteCommand(conn, "systemctl daemon-reload");
        await runRemoteCommand(conn, "systemctl stop nvr-agent.service || true");
        await runRemoteCommand(conn, "systemctl enable nvr-agent.service");
        const startResult = await runRemoteCommand(conn, "systemctl start nvr-agent.service");
        
        if (startResult.code === 0) {
          console.log(`[${node.host}] ✅ Agente NVR desplegado e iniciado con éxito.`);
          
          // Consultar estado para verificar que esté corriendo
          const statusResult = await runRemoteCommand(conn, "systemctl is-active nvr-agent.service");
          console.log(`[${node.host}] Estado del servicio: ${statusResult.stdout}`);
        } else {
          console.error(`[${node.host}] ❌ Error al iniciar el servicio: ${startResult.stderr}`);
        }

        conn.end();
        resolve({ host: node.host, success: true });
      } catch (err) {
        console.error(`[${node.host}] ❌ Error crítico durante el despliegue:`, err.message);
        conn.end();
        resolve({ host: node.host, success: false, error: err.message });
      }
    }).on("error", (err) => {
      console.error(`[${node.host}] ❌ Error de conexión SSH:`, err.message);
      resolve({ host: node.host, success: false, error: err.message });
    }).connect(node);
  });
}

async function run() {
  console.log("==================================================");
  console.log(" INICIANDO DESPLIEGUE ORQUESTRADO DE AGENTES NVR ");
  console.log("==================================================");
  
  const results = [];
  for (const node of nodes) {
    const res = await deployToNode(node);
    results.push(res);
  }
  
  console.log("\n==================================================");
  console.log(" RESUMEN DE DESPLIEGUE: ");
  console.log("==================================================");
  results.forEach(r => {
    if (r.success) {
      console.log(`- Node ${r.host}: ✅ ÉXITO`);
    } else {
      console.log(`- Node ${r.host}: ❌ FALLÓ (${r.error})`);
    }
  });
  console.log("==================================================");
}

run();
