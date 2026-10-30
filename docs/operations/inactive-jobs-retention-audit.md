# Inactive Jobs Retention Audit — Findings (2026-10-29)

## Scope and safety

This is an investigation note based on read-only queries against the current Supabase database and review of the repository import workflows. No production rows, schema, functions, or scheduled jobs were changed. Do not delete or bulk-update jobs based on age alone.

## Current data snapshot

- `public.jobs`: 31,714 rows.
- `active`: 2,403; `expired`: 5,032; `inactive`: 24,279.
- Inactive rows by source: `onjob` 22,809; `himalayas` 1,165; `Jobicy` 300; `jobicy` 4; `arabjobs` 1.
- The inspected inactive rows had values for `canonical_url`, `source_job_id`, `title`, and `description`; this does not prove that the source pages still exist or that the jobs are duplicates.
- The `jobs` table and indexes occupy about 255 MB in total (table about 38 MB, indexes about 104 MB). Moving rows to another table in the same database would not itself reclaim this storage.

## Important dependencies

Foreign keys pointing at `public.jobs(id)`:

| Table | Column | Delete behavior |
|---|---|---|
| `external_job_applications` | `job_id` | CASCADE |
| `notifications` | `job_id` | CASCADE |
| `madkhal_applications` | `job_id` | SET NULL |

A deletion could therefore remove external application history and notifications, or detach Madkhal applications. Although the initial count check found no dependent rows for the inactive cohort in these tables, the foreign-key behavior makes deletion unsafe without a fresh recheck and explicit retention policy.

Database objects observed that depend on `jobs` include views `active_jobs`, `external_opportunity_match_results`, `madkhal_investor_metrics`, `madkhal_operations_snapshot`, `madkhal_source_health`, and `opportunities_unified`; functions also reference the table. Keep this dependency map in mind before any schema or retention change.

## Importer behavior risks

Review of current database functions found:

- `import_onjob_jobs()` imports the latest successful JSON response and uses `ON CONFLICT (source, source_job_id)` to update matching records, setting their status to `active` and `last_checked_at=now()`.
- `import_himalayas_jobs()` similarly sets matching rows to `active` on each successful feed import.
- `import_jobicy_feed()` also reactivates matching rows in the feed.
- `import_1qatarjobs_feed()` sets matching rows to `active` on conflict.
- `worklink_sync()` advances through pages and sets imported records active.

This behavior is reasonable only when the fetched feed is authoritative for the listing's current availability. A job missing from a feed is not automatically marked inactive by the code reviewed here; conversely, a job reappearing in a feed is reactivated without independently verifying the apply page. Before changing status rules, verify feed completeness, pagination, and source semantics.

The current `public.expire_old_jobs()` function only expires active rows whose `expires_at` is in the past. `private.refresh_expired_jobs()` also checks a parsed deadline in the description and marks related external notifications expired. Neither function is a general stale-source cleanup mechanism.

The `UN Careers` workflow is manual-dispatch only and sets imported rows to `active`; its reviewed payload does not parse a closing date. It should not be used as evidence that every stored UN job remains open.

## Source freshness flags (review required, not proof of closure)

- `worklink`: 52 active rows had `last_checked_at` older than 30 days; latest observed check was 2026-09-08.
- `tamara`: 30 active rows had no `last_checked_at`.
- `1qatarjobs`: 4 active rows older than 30 days; the separate `1QatarJobs` label also exists, so normalize labels only after checking uniqueness and importer conflict keys.
- `gulfjobs`, `Jobs of Oman`, `akhtaboot`, `1QatarJobs`, and `fao` each have some active rows older than 7 days; this is a prioritization signal for a source-health check, not proof those vacancies are closed.
- `myself.ae` active rows were checked within the previous 7 days in the snapshot.

## Recommended next steps

1. Confirm each source's feed pagination and successful-run history before deciding whether a stale record should be inactive.
2. Add monitoring for importer failure, zero-result feeds, stale `last_checked_at`, and duplicate source labels.
3. Create a dry-run report of candidate records grouped by source and age; review samples against source pages before any status update.
4. If a retention policy is approved, prefer a reversible status transition first. Do not hard-delete jobs unless dependent application/notification retention has been explicitly addressed.
5. Review the security posture and execution grants for the `SECURITY DEFINER` functions separately; this audit did not modify or certify their permissions.

## Read-only verification

The companion `inactive-jobs-retention-audit.sql` file contains SELECT-only queries for status counts, source freshness, source-label variants, and dependent-row checks. Re-run it immediately before any approved operation because counts change over time.
