# --- ETAPA 1: Construcción de Producción ---
FROM node:20-slim

WORKDIR /app

# Instalar herramientas de compilación básicas necesarias para paquetes nativos de C++ (como sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar solo dependencias de producción de forma limpia y rápida
RUN npm ci --only=production --prefer-offline --no-audit --build-from-source

# Copiar el resto del código fuente del backend
COPY . .

# Exponer el puerto configurado de la API (3000 por defecto)
EXPOSE 3000

# Comando para iniciar la aplicación en producción
CMD ["npm", "start"]
