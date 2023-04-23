FROM node:18-alpine
WORKDIR /app

COPY package*.json .
RUN npm ci

COPY . .
CMD ["node", "index.js"]