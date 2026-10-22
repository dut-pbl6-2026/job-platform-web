FROM node:26-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:5000
ARG VITE_API_BASE_URL=/api
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
# 127.0.0.1, not localhost: alpine resolves localhost to ::1 first, but nginx
# listens on IPv4 only (listen 80;) -> the probe would fail and mark the
# container unhealthy even though the site is served correctly.
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/ || exit 1
