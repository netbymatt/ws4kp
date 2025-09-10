FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .

RUN npm run build

EXPOSE 8080

ENV DIST=1
CMD ["npm", "start"]
