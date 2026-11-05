# Existing staff creation authority baseline

Supabase Primary project `qqewusetilxxfvfkmsed`, deployed `create-staff-user` version **34**, was inspected read-only through `get_edge_function`. The deployed code already contained explicit caller authentication and protected profile authorization and differed from the unsafe older local file. No account creation endpoint was invoked. No real row, token, password or permission values were read.

The local entrypoint and handler were restored byte-for-byte from deployed v34 to prevent future redeployment of the older unsafe implementation. Runtime settings and the existing deployment were unchanged.

Existing deployed behavior: bearer token checked with Supabase Auth; verified email and trusted legacy/server-owned role evidence; protected staff profile role=super_admin and active gate; bounded sanitized staff payload; duplicate check; Auth user plus profile creation; Auth rollback on profile failure; no credential logging.

This is an exact source restoration, not a claim that every possible authority issue in the existing endpoint was changed. Profile bootstrap compatibility and broader authority hardening are covered by the separate expanded operations review.

| Restored source | SHA-256 |
| --- | --- |
| `supabase/functions/create-staff-user/index.ts` | `f009f4e1680decbeea1a5619490faf8fc2cd20b934877ba74df9b69de2280afb` |
| `supabase/functions/create-staff-user/handler.ts` | `c54d3345d6357d40cf676c516f8fd1b08df50c8a432d158174a2020d9047a99a` |
