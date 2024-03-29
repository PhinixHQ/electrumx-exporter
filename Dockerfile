FROM node:alpine
ENV LISTEN_PORT 9097
EXPOSE $LISTEN_PORT
WORKDIR /app

ADD package.json .
ADD yarn.lock .
RUN yarn

COPY . .
ENTRYPOINT node electrumx.js
