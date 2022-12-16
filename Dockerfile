FROM node:16-bullseye

ARG ROOT_DIR=/pocket-relay-stress-test

ENV NODE_OPTIONS="--max_old_space_size=8196"

RUN mkdir  $ROOT_DIR
ADD . $ROOT_DIR/

WORKDIR $ROOT_DIR

RUN npm install
RUN npm run build

WORKDIR $ROOT_DIR/lib

ENTRYPOINT ["node", "index.js"]
