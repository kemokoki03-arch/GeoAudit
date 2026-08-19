GeoAudit Studio V42 - Fast Daily Requests

Review queue improvements:
- Fixes DD-MM-YYYY dates such as 19-08-2026.
- Loads only the selected day's requests instead of downloading the entire review table.
- Filters reviewer requests at Supabase when possible.
- Keeps request order by ascending id.
- Uses an in-memory day cache for instant reopening/date switching.
- Realtime changes patch the visible queue directly instead of reloading the full dataset.
- Decisions update the current list instantly and move to the next request without a heavy refresh.
