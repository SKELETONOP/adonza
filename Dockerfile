FROM node:22-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

COPY package.json package-lock.json* ./

# Full install (including devDependencies) - the build step below needs
# vite/typescript, which only live in devDependencies. NODE_ENV isn't set
# to "production" yet at this point specifically so npm doesn't skip them.
RUN npm install

COPY . .

RUN npm run build

# Now that the build output exists, drop devDependencies to keep the
# final image lean - nothing at runtime needs vite/typescript/eslint.
RUN npm prune --omit=dev && npm cache clean --force

ENV NODE_ENV=production

CMD ["npm", "run", "docker-start"]
