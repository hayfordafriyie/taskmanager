FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=""
ARG VITE_API_VERSION=v1
ARG VITE_ENCRYPTED_MARKER=1

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_API_VERSION=${VITE_API_VERSION} \
    VITE_ENCRYPTED_MARKER=${VITE_ENCRYPTED_MARKER}

RUN npm run build

FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /usr/share/caddy

EXPOSE 80 443