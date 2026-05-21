ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.19
FROM ${BUILD_FROM}

ENV LANG=C.UTF-8

# Paquets : CUPS + Node.js + outils
RUN apk add --no-cache \
      bash jq tini curl ca-certificates \
      nodejs npm \
      cups cups-client cups-filters ghostscript

WORKDIR /app
COPY package.json agent.mjs run.sh /app/
RUN chmod +x /app/run.sh && npm install --omit=dev --no-audit --no-fund

ENTRYPOINT ["/sbin/tini","--"]
CMD ["/app/run.sh"]
