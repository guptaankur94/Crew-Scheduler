# CrewCircadian server: serves the web app and the roster reader (/api/roster/parse).
# Build:  docker build -t crewcircadian .
# Run:    docker run -p 3000:3000 --env-file .env.production crewcircadian
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm run bundle:update
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 TRUST_PROXY=1
EXPOSE 3000
# Health check: the web app's front page answers
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
