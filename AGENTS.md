# Development instructions

## Git workflow

- Inspect the current Git status before editing.
- Preserve unrelated user changes.
- Work on one coherent feature or fix at a time.
- Run relevant checks before committing.
- Use Conventional Commit messages.

Examples:

- `feat: add node category editing`
- `fix: prevent duplicate annotations`
- `docs: update labeling workflow`

## Push policy

- Commit and push each coherent, tested update to `origin/main`.
- Do not push broken or partially tested changes.
- Review the staged file list and diff before every commit.

## Data safety

- Never commit surgical videos, medical images, patient identifiers, local datasets, or exported annotation results.
- Keep mock grounding clearly marked as placeholder data.
- Confirm that no secrets or local credentials are present before pushing.
