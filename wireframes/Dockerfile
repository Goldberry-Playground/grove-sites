# Static wireframe showcase — served by nginx-alpine on port 80.
#
# Build:    docker build -f wireframes/Dockerfile -t grove/wireframes:smoke wireframes/
# Run:      docker run -d --name grove-wireframes-smoke -p 3004:80 grove/wireframes:smoke
#
# Production (DO App Platform): infra/do/wireframes.yaml deploys this as a
# Static Site component (free tier) — DO serves the HTML/CSS directly from
# its CDN without a running container.

FROM nginx:1.27-alpine

# Drop the default nginx welcome page.
RUN rm -rf /usr/share/nginx/html/*

# Copy the wireframe tree. index.html (root) shows the showcase landing;
# /hub/, /goldberry/, /ggg/, /nursery/ each contain per-brand wireframes.
COPY . /usr/share/nginx/html/

# Trim any files that aren't part of the served bundle, and normalize perms
# (some host files come in as mode 600 from a restrictive umask, which nginx
# — running as the `nginx` user, not root — cannot read; 403 Forbidden).
RUN find /usr/share/nginx/html -name 'Dockerfile' -delete \
    && find /usr/share/nginx/html -type d -exec chmod 755 {} + \
    && find /usr/share/nginx/html -type f -exec chmod 644 {} +

EXPOSE 80

# nginx-alpine ships with a default config that serves /usr/share/nginx/html.
