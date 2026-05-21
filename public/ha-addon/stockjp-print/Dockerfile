ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG=C.UTF-8

RUN apk add --no-cache \
      nodejs npm \
      cups cups-client cups-filters cups-libs \
      ghostscript \
      bash jq curl tini

WORKDIR /app
COPY package.json agent.mjs run.sh /app/
RUN chmod +x /app/run.sh && npm install --omit=dev --no-audit --no-fund

ENTRYPOINT ["/sbin/tini","--"]
CMD ["/app/run.sh"]
