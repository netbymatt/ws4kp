FROM node:24-alpine AS node-builder
WORKDIR /app

# RUN npm install gulp

COPY package.json .
COPY package-lock.json .

COPY . .

RUN npm install
RUN npm run build

FROM nginx:alpine
# COPY --from=node-builder /app/server /usr/share/nginx/html
COPY --from=node-builder /app/dist /usr/share/nginx/html
