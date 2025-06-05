FROM node:24-alpine
WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm ci

COPY . .
CMD ["node", "index.mjs"]
