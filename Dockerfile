# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.2.13

WORKDIR /app

COPY . /app

# install dependencies
RUN bun install

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "main.ts" ]