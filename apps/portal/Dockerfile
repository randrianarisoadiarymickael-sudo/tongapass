# syntax=docker/dockerfile:1.7
# ---- build : application Vite ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_KEYCLOAK_URL=http://localhost:8180
ARG VITE_API_URL=/api/v1
ENV VITE_KEYCLOAK_URL=${VITE_KEYCLOAK_URL} VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---- runtime : nginx non privilégié (port 8080, utilisateur 101) ----
FROM nginxinc/nginx-unprivileged:1.29-alpine
ARG VITE_KEYCLOAK_URL=http://localhost:8180
USER root
COPY nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/snippets/ /etc/nginx/snippets/
RUN sed -i "s#__KEYCLOAK_URL__#${VITE_KEYCLOAK_URL}#g" /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
