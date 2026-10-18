FROM --platform=linux/386 alpine:3.22@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8
RUN apk add --no-cache bash nano coreutils grep findutils tar gzip linux-virt cpio inotify-tools
RUN adduser -D -s /bin/bash student && passwd -d student
COPY guest/ /ukos/
COPY assemble.sh /assemble.sh
RUN sh /assemble.sh
