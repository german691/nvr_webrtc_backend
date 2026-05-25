# Guía Rápida y Configuración - NVR WebRTC

## 1. Configuración del Entorno (.env)

### Backend (`/nvr_webrtc_backend/.env`)
```env
PORT=3000
JWT_SECRET=4345ee152ce84f7292bf45cd58a6f99e211e67c9e9c4a02c79b6b0175dbe5765
```

### Frontend (`/nvr_webrtc_frontend/.env`)
```env
VITE_API_URL=http://localhost:3000
```

---

## 2. Autenticación y Control de Acceso

El sistema utiliza un control de acceso basado en roles (RBAC) almacenado en una base de datos local SQLite (`database.sqlite`).

*   **Usuario Inicial Administrador (Creado automáticamente al primer inicio):**
    *   **Username:** `tecnologia`
    *   **Password:** *Definida en base de datos al inicializar (requiere cambio obligatorio en el primer inicio de sesión).*
*   **Políticas de Roles:**
    *   **Admin:** Gestión total de usuarios (crear, editar, eliminar y restablecer contraseñas). No puede eliminarse a sí mismo.
    *   **Viewer:** Visualización de cámaras y modificación de su propia contraseña. Sin acceso a configuraciones.
*   **Seguridad:** Todo usuario nuevo tiene activa la bandera `password_changed = 0`, lo que le obliga a definir una nueva contraseña inmediatamente al ingresar.

---

## 3. Comandos de Ejecución

En ambos directorios, instale dependencias antes del primer inicio (`npm install` o `npm ci`).

### Iniciar Backend
```bash
npm run dev
# o para producción: npm start
```

### Iniciar Frontend
```bash
npm run dev
```
