# ============================================================================
# Imagen Docker del Proyecto Final - Lenguajes Formales y Autómatas
# Construir:  docker compose up -d --build      (o: docker build -t automatas .)
# ============================================================================
FROM oven/bun:1.3-slim

WORKDIR /app
ENV NODE_ENV=production

# Fuente china para el PDF del análisis léxico (pdf.service.js la busca aquí)
RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/*

# 1. Dependencias (se instalan dentro de la imagen, para Linux; no se copia node_modules)
COPY package.json bun.lock ./
RUN bun install --production

# 2. Código de la aplicación (el .env NO se copia: se pasa al ejecutar)
COPY src ./src
COPY assets ./assets

# Se ejecuta sin privilegios de administrador
USER bun

EXPOSE 3000

# Docker revisa que la app responda (GET /api/health)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "run", "src/app.js"]
