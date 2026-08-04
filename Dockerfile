FROM node:22
WORKDIR /app
COPY src/package.json ./
RUN npm install --omit=dev
COPY ./src /app
CMD [ "node", "server.js" ]
