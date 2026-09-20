# DSSSMS — Database Migration Guide

## Overview

Prisma manages all schema migrations. Each migration is a versioned SQL file
under `backend/prisma/migrations/`. Migrations are idempotent and safe to
re-run with `prisma migrate deploy`.

---

## Standard Migration Workflow

### Development

```bash
cd backend
# Make changes to prisma/schema.prisma, then:
npx prisma migrate dev --name describe-your-change
npx prisma generate
```

### Production / Staging

```bash
cd backend
npx prisma migrate deploy   # applies all pending migrations; never resets data
```

---

## v2.0 — Grades Schema (Breaking Change)

Version 2.0 replaced the old `Grade` model with a more flexible
`GradeComponent` + `GradeEntry` design (allowing multiple assessment
categories per subject, per semester).

### If you have existing Grade data (pre-v2)

1. **Back up the database first:**
   ```bash
   mysqldump -u USER -p DATABASE > backup_pre_v2_$(date +%Y%m%d).sql
   ```

2. Apply the migration:
   ```bash
   npx prisma migrate deploy
   ```

3. Old Grade rows are not automatically converted — re-enter results
   through the new Grade Entry workflow in the app.

### Fresh deployments

```bash
npx prisma migrate deploy
```

No manual steps required.

---

## Rollback Strategy

Prisma does not provide automatic rollbacks. To revert a migration:

1. Restore from the SQL backup taken before the migration.
2. Remove the migration directory from `backend/prisma/migrations/`.
3. Run `npx prisma migrate resolve --rolled-back MIGRATION_NAME`.
