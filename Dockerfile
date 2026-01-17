# Usar Node 20 LTS como imagen base
FROM node:20-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (incluyendo devDependencies para el build)
RUN npm ci

# Copiar el código fuente del proyecto
COPY . .

# Construir la aplicación React con Vite
RUN npm run build

# Crear directorio para la base de datos si no existe
RUN mkdir -p /app/data

# Exponer el puerto configurado
EXPOSE 10100

# Variables de entorno (pueden ser sobrescritas al ejecutar el contenedor)
ENV NODE_ENV=production

# Comando para ejecutar la aplicación en modo producción
CMD ["npm", "start"]
