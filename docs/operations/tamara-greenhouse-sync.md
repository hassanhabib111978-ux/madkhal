# Tamara — Greenhouse public job feed

## Source and access

- Source: Tamara's public Greenhouse job board, board token `tamara`.
- API: `GET https://boards-api.greenhouse.io/v1/boards/tamara/jobs?content=true`.
- Greenhouse documents that Job Board GET endpoints are publicly available without authentication. Madkhal only reads public postings; it does not submit applications through the API or access private applicant data.
- Original application URLs from the feed are preserved as both source and canonical URLs so applicants continue to the employer's own application page.

## Scheduled workflow

- `madkhal-tamara-fetch`: hourly at minute 0; requests the current public board through `pg_net` and records the request in `madkhal_external_feed_requests`.
- `madkhal-tamara-import`: hourly at minute 5; parses completed HTTP 200 JSON responses, upserts by `(source, source_job_id)`, updates `last_checked_at`, and records first publication, location, department mapping, deadline, and readable plain-text description.
- The importer validates that the `jobs` array length and unique valid IDs match the API's `meta.total`. It does not reconcile missing jobs when the feed is empty, incomplete, malformed, duplicated, or failed.
- After a complete feed has been validated and upserted, previously active Tamara rows missing from the feed are marked `inactive`, not deleted. If an opportunity is later published again, the official feed can reactivate that exact ID.
- Applications remain external: opening a Tamara job takes the applicant to its original Greenhouse URL.

## Initial live verification

- A direct request to the official public board returned HTTP 200 on 2026-10-30.
- The feed contained 40 jobs, 40 unique IDs, and `meta.total = 40`.
- At the pre-sync database audit, 30 Tamara rows were active, 14 of those IDs were absent from the official board, and 24 IDs were new to Madkhal.
- Production import completed successfully on 2026-10-30 at 11:30:54 UTC: 40 current IDs are active and checked, and the 14 previously stored active rows absent from the official feed are now inactive (not deleted). The table retains 54 Tamara rows in total.

## Operational checks

- Monitor the latest `madkhal-tamara-fetch` and `madkhal-tamara-import` cron runs.
- Alert on consecutive request/import failures, incomplete feed metadata, or a zero-job response; never deactivate current rows from an incomplete feed.
- Review source freshness periodically and compare a sample of original job links against the official board.
- Keep this integration separate from paid subscriptions and email alerts.