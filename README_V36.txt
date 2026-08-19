GeoAudit Studio V36

- Shift+S now uses KeyboardEvent.code (KeyS), so it works even when Windows/keyboard layout is Arabic.
- Shift+Z restores the last cleared dataset silently.
- Integrated review queue uses the same Supabase Auth/backend as the public system-review project.
- Login session is persisted by Supabase Auth; GeoAudit never stores the password itself.
- Reviewer users only see their assigned latest-date pending requests; admin users see the latest-date pending queue available to their account.
- Accept/Reject automatically advances to the next request.
- Full original review site can be opened inside the app in an iframe from the review drawer.
