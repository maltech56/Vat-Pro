# VAT Pro Database Migrations

**Project:** Maltech VAT Pro

**Database:** PostgreSQL 17

**Migration Strategy:** Forward-only, version-controlled SQL migrations

**Last Updated:** 2026-07-25

# VAT Pro Database Migrations

## Purpose

This directory contains all database schema migrations for VAT Pro.

A migration is a version-controlled SQL script that changes the database structure in a safe and repeatable way.

Every schema change must have:

- A SQL migration file
- Documentation
- A corresponding Git commit
- Verification after execution

The goal is to ensure every database change can be reproduced on Development, Testing, Staging, and Production environments.
---

---

# Directory Structure

backend/
└── migrations/
    ├── README.md
    ├── 2026-07-25-add-immutable-filing-snapshot.sql
    ├── 2026-08-03-add-user-audit-log.sql
    └── 2026-08-15-create-license-table.sql

Each migration represents one logical database change.

# Naming Convention

Migration files must use the format:

YYYY-MM-DD-description.sql

Examples:

2026-07-25-add-immutable-filing-snapshot.sql

2026-08-03-add-user-audit-log.sql

2026-08-15-create-license-table.sql

The date should represent the day the migration was created.
---

# Migration Workflow

Every migration must follow this process.

## 1. Backup

Always create a PostgreSQL backup before executing any migration.

## 2. Review

Review the SQL to ensure it has been tested on the development database.

## 3. Execute

Run the migration against the development database.

## 4. Verify

Verify:

- Tables
- Columns
- Constraints
- Indexes
- Existing data

## 5. Test

Run the application and verify that the affected functionality still works.

## 6. Commit

Commit the migration together with the application code that depends on it.

## 7. Deploy

Apply the migration to staging or production only after successful testing.
---

# SQL Standards

Each migration should:

Each migration should:

- Include a descriptive header comment.
- Be reviewed before execution.
- Be tested on the development database.
- Preserve production data.
- Avoid dropping columns unless absolutely necessary.
- Avoid destructive UPDATE or DELETE statements without approval.
- Use transactions where supported.
- Leave the database in a valid state if execution completes successfully.
- Avoid destructive changes without backups.
- Preserve existing production data.
- Include comments describing the purpose.
- Execute successfully in a single transaction whenever possible.
---

# Example

Example migration:

```
2026-07-25-add-immutable-filing-snapshot.sql
```

Purpose:

Adds immutable filing snapshot support.

New columns:

- audit_score
- audit_readiness
- transaction_count
- linked_transaction_count
- missing_document_count
- document_count
- supporting_transactions
- linked_documents
- missing_document_warnings
---

# Production Deployment Checklist

Before applying a migration:

- Database backup completed
- Migration reviewed
- SQL tested
- Application tested
- Rollback plan documented

After applying:

- Schema verified
- Application verified
- Logs reviewed
- Backup retained
---

---

# Rollback Policy

Every migration should have a documented rollback strategy.

Rollback methods may include:

- Restoring the database from backup.
- Executing a dedicated rollback script.
- Applying a corrective forward migration.

Destructive schema changes should never be executed without a verified backup.

---

# Migration Review Checklist

Before approving a migration, verify:

- Naming follows the project standard.
- SQL syntax has been validated.
- Existing data is preserved.
- Constraints are correct.
- Indexes are updated if required.
- The application has been tested.
- The migration has been committed to Git.

---

# Planned Future Migrations

Examples:

- Filing approval workflow
- User audit logging
- Company branding enhancements
- VAT rate history
- Digital signatures
- SaaS licensing
- Notification history

---

# Migration History

| Version | Date | Migration | Status | Notes |
|---------|------|-----------|--------|------|
| 001 | 2026-07-25 | Add Immutable Filing Snapshot | Complete | Added audit snapshot and JSON snapshot columns |