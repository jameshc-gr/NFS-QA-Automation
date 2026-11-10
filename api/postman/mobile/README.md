# Mobile Postman Collections

## Work History

### 2026-11-10 - QA collection source sync

- Compared `Gateway.postman_collection_111026.json` with `fsp-api-gateway`'s `qa` collection. The local file already matched the source byte-for-byte.
- Refreshed it from the latest fetched `qa` revision (`c9a0074`) and purged the older July collection from the current Git index; the dated replacement is staged.
- Replaced the corporate reset-password request's inline account/token/password values with GraphQL variables (`RESET_EMAIL`, `RESET_TOKEN`, `NEW_PASSWORD`). Preserved all 16 Yopmail test references.
- Validation confirmed valid JSON and exact source parity outside that request. `npm run check:root` and Git whitespace checks passed.
- The upstream `qa` source still contains the corporate reset literal; it was not changed by this local sync. Coordinate a source-repository fix and rotate/revoke any value that may still be valid.
