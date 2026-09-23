FROM node:22-alpine
# ca-certificates is required separately from openssl - without it there's
# no root CA bundle, and TLS connections to services like MongoDB Atlas fail
# with an opaque "received fatal alert: InternalError" instead of a clear
# certificate-verification error.
RUN apk add --no-cache openssl ca-certificates

EXPOSE 3000

WORKDIR /app

COPY package.json package-lock.json* ./

# Full install (including devDependencies) - the build step below needs
# vite, which only lives in devDependencies. NODE_ENV isn't set to
# "production" yet at this point specifically so npm doesn't skip it.
RUN npm install

COPY . .

RUN npm run build

# Now that the build output exists, drop devDependencies to keep the
# final image lean - nothing at runtime needs vite/typescript/eslint.
RUN npm prune --omit=dev && npm cache clean --force

ENV NODE_ENV=production

CMD ["npm", "run", "docker-start"]
