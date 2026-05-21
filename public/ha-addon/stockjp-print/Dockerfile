ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-debian:bookworm
FROM ${BUILD_FROM}

ENV LANG=C.UTF-8 \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates gnupg jq tini bash \
      cups cups-client cups-bsd cups-filters ghostscript \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json agent.mjs run.sh /app/
RUN chmod +x /app/run.sh && npm install --omit=dev --no-audit --no-fund

ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["/app/run.sh"]
