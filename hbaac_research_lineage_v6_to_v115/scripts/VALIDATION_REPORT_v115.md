# v115 Reproduction Package Validation

Package created for the final v115 submission.

## Final submission file

`submission_v115_PUBLIC_v89_extrap1500_PRIVATE_v85.csv`

## Format checks

- Rows: 31,944
- Columns: 29
- Expected rows from sample: 31,944
- Expected columns from sample: 29
- ID order matches sample: True
- Duplicate IDs: 0
- Negative forecast cells: 0
- NaN forecast cells: 0

## Known scores reported by team

- Public: 0.48334
- Private: 0.52023

## Dependency chain

```text
v60 upstream base forecast
└── v77 = trend-strong model from v60
    ├── v88 = micro DOW adjustment on v77
    └── v89 = profit-aware DOW adjustment on v77

v85 = stronger recent-momentum trend model from v60

v115:
- validation rows = v89 + 15.0 × (v89 - v88), clipped to zero
- evaluation rows = v85
```
