# دستور مَدخَل — Product Constitution

## 1. Identity
مَدخَل is a connected employment platform for the Middle East, not a generic jobs list and not a gig-market clone.

## 2. Core journey
### Seeker
Profile → identity details → occupation → qualification → experience → skills → work preferences → evaluation → matching → ranking → opportunity details → application → application tracking.

### Employer
Employer profile → create opportunity → occupation and requirements → confirmation → matching → candidate response → communication → interview/offer/hired.

## 3. Product truth
- Public job sources remain intact unless a source is explicitly deprecated.
- Existing source data must not be rebuilt or silently replaced during UI repairs.
- A current match is not the same thing as a historical application.
- A notification is not a match unless it is produced from the current matching path.
- A historical application must never be presented as a current recommendation.
- A displayed score must identify whether it is an official direct-match score or an estimated public-opportunity score.
- No score is a promise of employment.

## 4. Free and paid boundary
Free:
- browse/search public opportunities;
- view opportunity details;
- basic application where the source permits it;
- maintain a professional profile.

$1/month worker subscription:
- continuous matching;
- automatic new-opportunity matching;
- continuous alerts;
- ranking/follow-up;
- saved search and application follow-up features as implemented.

Payment activation must never be assumed from a client-side flag. The authoritative subscription state is the server-side Supabase subscription record.

## 5. Safety of changes
Before changing production behavior:
1. inspect the existing path;
2. preserve working source integrations;
3. make the smallest coherent change;
4. avoid duplicate competing paths;
5. verify the affected data flow;
6. record the change.

## 6. Investment-readiness gates
A release is not considered product-ready until:
- seeker journey is coherent end-to-end;
- employer opportunity journey is coherent end-to-end;
- matching and notifications share one source of truth;
- application tracking is distinct from current matching;
- subscription state is authoritative and auditable;
- no test/dummy opportunities appear as production recommendations;
- mobile navigation and primary actions work reliably;
- errors fail safely without corrupting user state;
- the platform can be demonstrated as one product rather than disconnected screens.

## 7. AI / Jibran / automated engineer
Jibran may assist the user but must respect the same free/paid boundary as the matching engine.

The Madkhal automated engineer must:
- follow this constitution;
- inspect before modifying;
- preserve data sources;
- prefer reversible, minimal changes;
- never claim a repair was successful without verification;
- keep a change log;
- escalate when a required database/security change cannot be safely verified.

## 8. Current strategic priority
Do not add cosmetic features ahead of product integrity.
First make the existing seeker/employer/matching/application/subscription paths coherent and demonstrable.
Then add payment automation and deeper AI capabilities.
