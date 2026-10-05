# Madkhal Engineering Guardrails

## Mission
Treat Madkhal as one connected employment product. Preserve working behavior and fix root causes rather than adding patches.

## Mandatory workflow
1. Inspect the complete affected flow and its dependencies before editing.
2. Identify the single source of truth for each state: profile, occupation, skills, evaluation, matching, notifications, applications, employer opportunities, subscription.
3. Make the smallest coherent change. Do not create a second implementation of an existing responsibility.
4. Add or update a regression test for every bug fixed whenever technically possible.
5. Run static/syntax checks and the relevant regression tests before declaring success.
6. Review the diff for unrelated changes.
7. Do not merge if verification fails or if the change creates a competing source of truth.

## Production safety
- Never modify Middle East job-source ingestion to fix UI/matching problems.
- Never add dummy/test production jobs.
- Never rewrite historical applications or their historical scores.
- Never silently change scoring, filters, schema, or production data.
- Database changes require a reversible migration.
- Do not expose secrets.

## Definition of done
A task is not done because code was changed. It is done only when:
- the reported user journey works;
- the relevant regression test passes;
- syntax/build checks pass;
- no duplicate authority was introduced;
- working job sources remain untouched;
- the PR explains what was verified and what remains unverified.

## Deployment rule
A GitHub commit is not evidence that GitHub Pages is serving it. Verify the deployment/run status before telling the user a production fix is live.

## Recovery
Prefer branches and reviewable PRs. Never force-push. If an agent takes a wrong direction, revert the branch rather than stacking another compensating patch.
