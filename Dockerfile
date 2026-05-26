FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias utilizando npm ci optimizado (sólo dependencias de producción)
RUN npm ci --omit=dev --prefer-offline --no-audit --progress=false

# Copiar el resto del código (excluye node_modules locales gracias a .dockerignore)
COPY . .

# Definir variables de entorno por defecto
ENV NODE_ENV=production
ENV API_PORT=3000

# El backend corre internamente en el puerto 3000
EXPOSE 3000

# Arrancar el servidor
CMD ["node", "server.js"]
