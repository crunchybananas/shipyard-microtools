# Actor row source contract

`manifest.json` is the authority for reviewable `512x84` actor rows. Each key
is `<role>/<action>/<direction>` and may hold two independent records:

- `production`: a SHA-256-locked row with status `accepted`. Only this slot is
  compiled into the production role sheet and runtime atlases.
- `candidate`: a SHA-256-locked row with status `candidate`. Sprite Lab shows
  this slot for review, but the compiler ignores it.

When a key has both slots, Sprite Lab labels the row `CANDIDATE` and separately
shows that the runtime remains `LOCKED`. When it has only a candidate, runtime
continues to inherit `BASE` art.

New candidate files live under `candidates/<role>/`. Newly promoted production
files live under `production/<role>/` and include their hash prefix in the
filename. Existing accepted v1 paths remain valid and migrate without changing
their bytes or hashes.

Use the workbench rather than editing the manifest:

```sh
scripts/sprite-row stage --role guard --action idle --dir down \
  --input path/to/guard-idle-down.png --provenance modular-source
scripts/sprite-row reject --role guard --action idle --dir down
scripts/sprite-row promote --role guard --action idle --dir down
scripts/sprite-row promote-family --role guard
scripts/sprite-row verify
```

`promote-family` validates every requested candidate first, writes
content-addressed production files, and changes all production authorities with
one atomic manifest replacement. A failed validation leaves every current
production lock unchanged.
