FROM --platform=linux/386 alpine:3.22@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8 AS linux
RUN apk add --no-cache bash nano coreutils grep findutils tar gzip linux-virt cpio inotify-tools
RUN adduser -D -s /bin/bash student && passwd -d student
COPY tools/ukos/guest/ /ukos/
COPY tools/ukos/assemble.sh /assemble.sh
RUN sh /assemble.sh

FROM node:24-alpine AS build
WORKDIR /workspace/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
COPY tools/ukos/ /workspace/tools/ukos/
COPY --from=linux /out/ ./prototypes/runtime/
RUN UKOS_IMAGE_READY=1 node ../tools/ukos/build.mjs
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.30-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/client/dist /usr/share/nginx/html
EXPOSE 80
