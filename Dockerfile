FROM node:18-alpine
COPY . .
RUN npm install
CMD ["node", "index.js"]