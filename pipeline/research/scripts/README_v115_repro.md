# HBAAC v115 Minimal Reproduction

This package reproduces the best v115 submission.

## Final v115 logic

- Public/validation rows: `v89 + 15.0 * (v89 - v88)`, clipped to non-negative.
- Private/evaluation rows: `v85`.

## Required input files

Place these files in the package root:

```text
train.csv
sample_submission.csv
v60_PUBLIC_v51_PRIVATE_v6_support_mask_015.csv
```

`v60` is treated as the upstream base forecast. The package then generates v77, v85, v88, v89, and finally v115.

## Why v115 depends on these versions

```text
v60 = upstream support-aware base forecast
v77 = trend momentum boost from v60
v85 = stronger trend momentum from v60; used for Private rows
v88 = DOW micro adjustment on v77
v89 = profit-aware DOW adjustment on v77
v115 = Public extrapolation from v88→v89 + Private v85
```

## Run

```bash
pip install -r requirements.txt
python run_all_v115.py
```

Output:

```text
submission_v115_PUBLIC_v89_extrap1500_PRIVATE_v85.csv
```

## Known leaderboard result

Reported by team:
- Public: 0.48334
- Private: 0.52023
