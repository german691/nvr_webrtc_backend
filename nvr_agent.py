#!/usr/bin/env python3
import asyncio
import websockets
import json
import os
import signal
import subprocess
import re
import socket
import argparse
import glob

# Configuración de argumentos de línea de comandos
parser = argparse.ArgumentParser(description="NVR Edge WebSocket Agent")
parser.add_argument("--server", default=os.environ.get("NVR_SERVER_IP", "192.168.1.100"), help="IP del Servidor Central NVR")
parser.add_argument("--port", default=os.environ.get("NVR_SERVER_PORT", "3000"), help="Puerto del Servidor Central NVR")
args = parser.parse_args()

SERVER_IP = args.server
SERVER_PORT = args.port

def get_local_ip():
    """Obtiene la IP local en el segmento de red de la mini-PC."""
    try:
        # Intentar conectar a una dirección del segmento para obtener la interfaz correcta
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect((SERVER_IP, int(SERVER_PORT)))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        # Fallback si el servidor no responde
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("192.168.1.254", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            try:
                return socket.gethostbyname(socket.gethostname())
            except Exception:
                return "127.0.0.1"

def get_capabilities():
    """Ejecuta el script local para leer las capacidades de las cámaras."""
    try:
        if os.path.exists("/usr/local/bin/get_capabilities.sh"):
            output = subprocess.check_output(["/usr/local/bin/get_capabilities.sh"], text=True)
            return json.loads(output)
    except Exception as e:
        print(f"[Agent Error] Fallo al ejecutar get_capabilities.sh: {e}")
    
    # Fallback si no existe o falla
    return []

def get_ffmpeg_processes():
    """Busca procesos FFmpeg de captura activos en el sistema y los formatea."""
    try:
        output = subprocess.check_output(["ps", "aux"], text=True)
        processes = []
        for line in output.splitlines():
            if "ffmpeg" not in line or "grep" in line:
                continue
            tokens = line.strip().split(None, 10)
            if len(tokens) < 11:
                continue
            
            user = tokens[0]
            pid = int(tokens[1])
            cpu = float(tokens[2])
            mem = float(tokens[3])
            vsz = int(tokens[4])
            rss = int(tokens[5])
            start = tokens[8]
            time = tokens[9]
            command = tokens[10]
            
            # Parsear argumentos usando expresiones regulares
            device_match = re.search(r'-i\s+([^\s]+)', command)
            device = device_match.group(1) if device_match else None
            
            # Solo nos interesan los streams de video de hardware
            if not device or not device.startswith("/dev/"):
                continue
                
            res_match = re.search(r'-video_size\s+([^\s]+)', command)
            resolution = res_match.group(1) if res_match else "N/A"
            
            fps_match = re.search(r'-framerate\s+([^\s]+)', command)
            fps = fps_match.group(1) if fps_match else "N/A"
            
            bitrate_match = re.search(r'-b:v\s+([^\s]+)', command)
            bitrate = bitrate_match.group(1) if bitrate_match else "N/A"
            
            vaapi_match = re.search(r'-vaapi_device\s+([^\s]+)', command)
            vaapi = vaapi_match.group(1) if vaapi_match else "N/A"
            
            processes.append({
                "user": user,
                "pid": pid,
                "cpu": cpu,
                "mem": mem,
                "vsz": vsz,
                "rss": rss,
                "start": start,
                "time": time,
                "device": device,
                "resolution": resolution,
                "fps": fps,
                "bitrate": bitrate,
                "vaapi": vaapi,
                "command": command
            })
        return processes
    except Exception as e:
        print(f"[Agent Error] Error al listar procesos FFmpeg: {e}")
        return []

def get_uvc_controls(device):
    """Consulta la lista de controles UVC físicos mediante v4l2-ctl."""
    try:
        output = subprocess.check_output(["v4l2-ctl", "-d", device, "-l"], text=True)
        controls = []
        for line in output.splitlines():
            line = line.strip()
            if not line or ":" not in line:
                continue
            
            parts = line.split(":")
            left = parts[0].strip()
            right = parts[1].strip()
            
            left_tokens = left.split()
            if not left_tokens:
                continue
            name = left_tokens[0]
            
            min_match = re.search(r'min=(-?\d+)', right)
            max_match = re.search(r'max=(-?\d+)', right)
            step_match = re.search(r'step=(-?\d+)', right)
            default_match = re.search(r'default=(-?\d+)', right)
            value_match = re.search(r'value=(-?\d+)', right)
            
            if default_match and value_match:
                is_bool = "(bool)" in left
                min_val = int(min_match.group(1)) if min_match else (0 if is_bool else None)
                max_val = int(max_match.group(1)) if max_match else (1 if is_bool else None)
                
                if min_val is not None and max_val is not None:
                    controls.append({
                        "name": name,
                        "min": min_val,
                        "max": max_val,
                        "step": int(step_match.group(1)) if step_match else 1,
                        "default": int(default_match.group(1)),
                        "value": int(value_match.group(1))
                    })
        return controls
    except Exception as e:
        print(f"[Agent Error] Error leyendo controles UVC para {device}: {e}")
        return []

def get_connected_cameras():
    """Devuelve un mapa de persistent_path -> dev_path de cámaras USB conectadas físicamente."""
    cameras = {}
    
    # 1. Intentar buscar por path persistente en by-path (Recomendado)
    if os.path.exists("/dev/v4l/by-path"):
        try:
            for name in os.listdir("/dev/v4l/by-path"):
                # udev crea enlaces tipo -video-index0 y -video-index1, filtramos index0
                if "-video-index0" in name:
                    persistent_path = os.path.join("/dev/v4l/by-path", name)
                    if os.path.islink(persistent_path):
                        real_path = os.path.realpath(persistent_path)
                        cameras[persistent_path] = real_path
            if cameras:
                return cameras
        except Exception as e:
            print(f"[Agent Error] Fallo al listar /dev/v4l/by-path: {e}")

    # 2. Fallback a glob directo sobre /dev/video*
    try:
        for path in glob.glob("/dev/video*"):
            # En v4l2, los números pares suelen ser streams reales, e impares metadatos
            # Para simplificar, registramos todos como fallback
            cameras[path] = path
    except Exception as e:
        print(f"[Agent Error] Fallo en fallback de dispositivos de video: {e}")
        
    return cameras

async def usb_monitor_task(websocket, node_ip):
    """Monitorea en segundo plano la desconexión/conexión en caliente de cámaras USB."""
    last_cameras = get_connected_cameras()
    print(f"[USB Monitor] Monitoreo USB activo. Cámaras iniciales: {list(last_cameras.values())}")
    
    while True:
        await asyncio.sleep(5)
        if not websocket.open:
            continue
            
        try:
            current_cameras = get_connected_cameras()
            
            # Detección de desconexión (hot unplug)
            for ppath, dev in last_cameras.items():
                if ppath not in current_cameras:
                    print(f"[USB Monitor] ❌ Cámara perdida físicamente: {dev} ({ppath})")
                    await websocket.send(json.dumps({
                        "event": "camera_lost",
                        "dev": dev
                    }))
            
            # Detección de conexión (hot plug)
            for ppath, dev in current_cameras.items():
                if ppath not in last_cameras:
                    print(f"[USB Monitor] 🔌 Cámara detectada físicamente: {dev} ({ppath})")
                    await websocket.send(json.dumps({
                        "event": "camera_found",
                        "dev": dev
                    }))
            
            last_cameras = current_cameras
        except Exception as e:
            print(f"[USB Monitor Error] Fallo al monitorear bus USB: {e}")

async def handle_command(websocket, message_str, node_ip):
    """Procesa un comando JSON recibido desde el servidor central y devuelve su estado."""
    try:
        data = json.loads(message_str)
        msg_id = data.get("msgId")
        action = data.get("action")
        
        if not action:
            return

        print(f"[Command] Comando recibido: '{action}' (msgId: {msg_id})")
        
        response_data = None
        status = "success"
        error_msg = None
        
        if action == "get_capabilities":
            response_data = get_capabilities()
            
        elif action == "get_active_streams" or action == "get_ffmpeg_debug":
            response_data = get_ffmpeg_processes()
            
        elif action in ("control_stream", "start", "stop"):
            stream_action = action if action in ("start", "stop") else data.get("action")
            dev = data.get("dev")
            
            if stream_action == "stop":
                killed = False
                for proc in get_ffmpeg_processes():
                    if proc["device"] == dev:
                        try:
                            os.kill(proc["pid"], signal.SIGKILL)
                            killed = True
                            print(f"[Stream] Detenido stream en {dev} (PID: {proc['pid']})")
                        except Exception as e:
                            print(f"[Stream Error] Fallo al detener {proc['pid']}: {e}")
                response_data = {"status": "success", "killed": killed}
            else:
                resolution = data.get("resolution")
                fps = data.get("fps")
                clean_bitrate = data.get("cleanBitrate")
                stream_path = data.get("streamPath")
                
                # Detener preventivamente cualquier ffmpeg en este mismo dispositivo
                for proc in get_ffmpeg_processes():
                    if proc["device"] == dev:
                        try:
                            os.kill(proc["pid"], signal.SIGKILL)
                            print(f"[Stream] Limpieza preventiva en {dev} (PID: {proc['pid']})")
                        except Exception:
                            pass
                
                # Comando FFmpeg con VAAPI acelerado por hardware
                cmd = [
                    "/usr/bin/ffmpeg",
                    "-hide_banner",
                    "-vaapi_device", "/dev/dri/renderD128",
                    "-f", "v4l2",
                    "-input_format", "mjpeg",
                    "-video_size", resolution,
                    "-framerate", fps,
                    "-i", dev,
                    "-vf", "format=nv12,hwupload",
                    "-c:v", "h264_vaapi",
                    "-bf", "0",
                    "-b:v", clean_bitrate,
                    "-f", "rtsp", f"rtsp://localhost:8554/{stream_path}"
                ]
                
                print(f"[Stream] Iniciando FFmpeg: {' '.join(cmd)}")
                proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
                # Esperar 0.5 segundos para comprobar que no crasheó al instante
                await asyncio.sleep(0.5)
                if proc.poll() is not None:
                    status = "error"
                    error_msg = "FFmpeg crasheó al iniciar. Verifique dispositivo USB o recursos del sistema."
                    print(f"[Stream Error] FFmpeg finalizó inmediatamente con código {proc.poll()}")
                else:
                    response_data = {
                        "pid": proc.pid,
                        "command_executed": " ".join(cmd)
                    }
                    print(f"[Stream] FFmpeg iniciado con éxito (PID: {proc.pid})")
                    
        elif action == "get_uvc_controls":
            dev = data.get("dev")
            response_data = get_uvc_controls(dev)
            
        elif action == "set_uvc_control":
            dev = data.get("dev")
            ctrl_name = data.get("controlName")
            val = data.get("value")
            
            try:
                subprocess.check_call(["v4l2-ctl", "-d", dev, f"--set-ctrl={ctrl_name}={val}"])
                response_data = {"status": "success"}
                print(f"[UVC] Control {ctrl_name} ajustado a {val} en {dev}")
            except Exception as e:
                status = "error"
                error_msg = f"Error al ejecutar v4l2-ctl: {e}"
                print(f"[UVC Error] Fallo al ajustar control: {e}")
                
        elif action == "kill_ffmpeg":
            pid = int(data.get("pid"))
            try:
                os.kill(pid, signal.SIGKILL)
                response_data = {"status": "success"}
                print(f"[Kill] Proceso ffmpeg {pid} terminado por señal.")
            except Exception as e:
                status = "error"
                error_msg = f"Error matando proceso {pid}: {e}"
                
        elif action == "kill_all_ffmpeg":
            killed_count = 0
            for proc in get_ffmpeg_processes():
                try:
                    os.kill(proc["pid"], signal.SIGKILL)
                    killed_count += 1
                except Exception:
                    pass
            response_data = {"status": "success", "killed_count": killed_count}
            print(f"[Kill All] {killed_count} procesos FFmpeg matados con éxito.")
            
        else:
            status = "error"
            error_msg = f"Acción '{action}' no soportada por el Agente."
            print(f"[Command Error] {error_msg}")

        # Enviar respuesta al backend
        resp = {
            "msgId": msg_id,
            "status": status
        }
        if status == "success":
            resp["data"] = response_data
        else:
            resp["error"] = error_msg
            
        await websocket.send(json.dumps(resp))
        
    except Exception as e:
        print(f"[Agent Error] Error procesando comando: {e}")

async def agent_loop():
    """Bucle principal de conexión asíncrona del Agente."""
    uri = f"ws://{SERVER_IP}:{SERVER_PORT}/ws/edge"
    backoff = 1
    
    print("==============================================")
    print(" INICIALIZANDO NVR EDGE AGENT (PYTHON 3)      ")
    print(f" Servidor central:  {uri}                     ")
    print("==============================================")
    
    while True:
        try:
            print(f"[WS] Conectando a {uri}...")
            async with websockets.connect(uri, ping_interval=5, ping_timeout=10) as websocket:
                backoff = 1
                
                # Obtener la IP local real del socket de la conexión establecida
                real_node_ip = websocket.local_address[0]
                print(f"[WS] Conexión establecida con éxito!")
                print(f"[WS] IP local detectada dinámicamente: {real_node_ip}")
                
                # 1. Enviar registro inicial
                cams = get_capabilities()
                reg_payload = {
                    "action": "register",
                    "nodeIp": real_node_ip,
                    "cameras": cams
                }
                await websocket.send(json.dumps(reg_payload))
                print(f"[WS] Registro de agente enviado con {len(cams)} cámaras.")
                
                # 2. Iniciar monitor USB en segundo plano
                monitor_task = asyncio.create_task(usb_monitor_task(websocket, real_node_ip))
                
                # 3. Escuchar comandos entrantes
                async for message in websocket:
                    asyncio.create_task(handle_command(websocket, message, real_node_ip))
                    
                # Cancelar la tarea de monitor al desconectarse
                monitor_task.cancel()
                
        except Exception as e:
            print(f"[WS Connection Error] Conexión perdida o fallida: {e}")
            
        # Reintento con backoff exponencial
        print(f"[WS] Reintentando en {backoff} segundos...")
        await asyncio.sleep(backoff)
        backoff = min(backoff * 2, 30)

if __name__ == "__main__":
    try:
        asyncio.run(agent_loop())
    except KeyboardInterrupt:
        print("\n[Agent] Parado por solicitud del usuario.")
