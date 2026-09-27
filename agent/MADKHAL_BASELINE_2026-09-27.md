# MADKHAL BASELINE — 2026-09-27

## Baseline purpose
This is a read-only architectural baseline for Madkhal Agent. It records what was observed before any agent write permissions are enabled.

## GitHub observations
Repository: hassanhabib111978-ux/madkhal
Main branch inspected: yes
Main was not modified by this baseline.
The repository already contains an official project constitution:
MADKHAL-DUSTOOR-V2.md
The agent constitution must extend that project constitution, not replace it.

Notable current structure includes:
- index.html (large production entry page)
- jibran.js and jibran-evaluation-enhancement.js
- worker-match-lifecycle.js
- madkhal-professional-score.js
- madkhal-region-filter.js
- payment/subscription related scripts
- employer flow/dashboard scripts
- multiple historical/fix scripts

Observation:
The repository contains accumulated fix/enhancement layers. Therefore the agent must prefer tracing the active execution path before adding another layer.

## Supabase observations
Project: qbufsdpdobuicpljnssr
Project status observed: ACTIVE_HEALTHY

The same Supabase project contains Madkhal data/functions and restaurant/bot data.
The agent scope must remain explicitly limited to Madkhal.

## Important existing project rules discovered
The repository's MADKHAL-DUSTOOR-V2.md is authoritative project context. It includes:
- preserve working behavior and make the smallest change;
- separate worker and employer subscription paths;
- free/basic workflow remains available;
- worker target subscription is $1/month;
- matching does not automatically expose contact data;
- protect completed job sources;
- do not restore OnJob to displayed jobs;
- prevent duplicate jobs;
- test and make changes reversible.

## Baseline safety status
Production data: not modified.
Job sources: not modified.
Cron/source infrastructure: not modified.
Main branch: not modified.
Supabase schema: not modified.

## Next diagnostic phase
The agent should next produce a component map and dependency map, then identify:
1. active entry points;
2. active script load order;
3. active profile flow;
4. active matching flow;
5. active evaluation flow;
6. active employer flow;
7. active subscription flow;
8. active job-source/import flow.

No repair should be performed as part of baseline generation.
