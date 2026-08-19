GeoAudit Studio V45 — Dual Review Sync

Review flow:
1) Choose Accept / Reject / QC inside GeoAudit.
2) GeoAudit applies the corresponding choice in the open landsurvey work form.
3) For Reject, the rejection reason is written into the work-site rejection field.
4) GeoAudit clicks the work-site Save button automatically.
5) Only after the work-site step succeeds, the same decision/reason is written to system-review (Supabase).
6) GeoAudit advances to the next request.

Safety:
- If the work-site review control or Save button cannot be found, GeoAudit does not mark the tracker request as completed and does not advance.
- "معلق" remains stored in system-review only because the supplied work-site screen has no explicit suspended result control. No invented work-site mapping is used.
