FROM node:20-alpine

WORKDIR /app

# Dependencias primero (cache layer)
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Código
COPY server.js .
COPY public/ public/
COPY scripts/ scripts/

EXPOSE 3001

CMD ["node", "server.js"]
