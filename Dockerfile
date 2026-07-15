# ============================================================
# eCabinet — Frontend (web)
# Build 2 tầng: build Vite -> phục vụ bằng nginx (proxy /api sang api)
# ARG VITE_API_URL: đặt "/api" (mặc định trong compose) để bật chế độ
# máy chủ; bỏ trống để build bản demo localStorage.
# ============================================================
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
