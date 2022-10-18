FROM node:16-bullseye

ARG ROOT_DIR=/pocket-relay-stress-test

RUN mkdir  $ROOT_DIR
ADD . $ROOT_DIR/

WORKDIR $ROOT_DIR

RUN npm install
RUN npm run build

WORKDIR $ROOT_DIR/lib

ENTRYPOINT ["node", "index.js"]
