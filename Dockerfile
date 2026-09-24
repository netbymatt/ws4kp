FROM node:24-alpine AS node-builder
WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm ci
COPY . .
RUN npm run build
RUN rm dist/playlist.json

FROM nginx:alpine

COPY static-env-handler.sh /docker-entrypoint.d/01-static-env-handler.sh
RUN chmod +x /docker-entrypoint.d/01-static-env-handler.sh

COPY --from=node-builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=60s --timeout=5s --start-period=15s --retries=3 \
	CMD wget -q --spider "http://127.0.0.1:8080/manifest.json" || exit 1


CMD ["nginx", "-g", "daemon off;"]
