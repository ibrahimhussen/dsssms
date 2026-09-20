# DSSSMS — Production Deployment Guide

## Prerequisites

- Node.js 20+
- MySQL 8.0+
- Docker & Docker Compose (for containerised deployment)

---

## 1. Environment Setup

```bash
cp backend/.env.production.example backend/.env
```

Edit `backend/.env` and replace every `REPLACE_*` placeholder with real secrets.

Generate JWT secrets:
```bash
openssl rand -base64 48   # run twice — one for ACCESS, one for REFRESH
```

---

## 2. Database

### Fresh deployment
```bash
cd backend
npx prisma migrate deploy
npx prisma db seed        # optional demo data
```

### Upgrading from a prior version
```bash
cd backend
npx prisma migrate deploy   # applies any pending migrations
```

Set up automated daily backups with at least 30-day retention.

---

## 3. Docker Deployment

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f backend

# Stop
docker compose down
```

---

## 4. Manual Deployment

```bash
# Backend
cd backend
npm ci --omit=dev
npx prisma generate
npm start

# Frontend
cd ..
npm ci
npm run build
# Serve the dist/ directory with Nginx or your preferred static host
```

---

## 5. Health Check

```
GET /health
```
Returns `{ status: "ok" }` when the API is running.

---

## 6. Monitoring Checklist

- [ ] Error rate alert: > 1% of requests returning 5xx
- [ ] Response time alert: p95 > 1000 ms
- [ ] Disk usage alert: > 80%
- [ ] Database connection pool exhaustion
- [ ] Failed login spikes (potential brute-force)

---

## 7. Security Checklist (pre-launch)

- [ ] `FORCE_HTTPS=true` in production `.env`
- [ ] `CORS_ORIGIN` set to your exact frontend domain (no wildcards)
- [ ] JWT secrets are 48+ random characters
- [ ] Database user has minimum required privileges (no `SUPER`)
- [ ] `NODE_ENV=production` is set
- [ ] `.env` file is NOT in the Docker image or version control
