# AI evaluation set (SPEC §13)

Labelled jobs used to measure competency-suggestion precision before suggestions are shown to verifiers (target:
≥ 80% per trade, 50 real jobs per trade, labelled by master artisans).

Layout: one folder per trade, one JSON file per job:

```json
{ "jobTypeKey": "solar_battery_inverter_install", "transcript": "…", "notes": [], "photos": ["a.jpg"], "labels": ["SOL-04", "SOL-05"] }
```

Run `pnpm --filter @sp/db eval` to print precision and recall per trade for the configured `LLM_DRIVER`. The sample
below uses fixture content and only checks the harness; replace it with real, consented, labelled jobs.
