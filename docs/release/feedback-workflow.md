# Feedback Incorporation Workflow (Tranche 3.4.6)

Defines how defects and suggestions from [user testing](./user-testing-protocol.md) flow into code changes and a tagged patch release.

---

## Triage Matrix

For each issue surfaced during user testing, the SDK lead assigns:

| Severity | Description | Action | Target release |
|---|---|---|---|
| **Critical** | Tester fully blocked; data loss risk; security flaw | Fix before 1.0.0 ships to npm | `1.0.0` |
| **Major** | Documented behavior broken; tester completed via workaround | Fix in first patch | `1.0.1` |
| **Minor** | Polish, ergonomics, performance under 2× of target | Fix opportunistically | `1.0.x` or `1.1.0` |
| **Doc-only** | Information missing or wrong in docs; code is fine | Fix immediately; no version bump | merged to `main` |

## Workflow

```
                ┌────────────────────────────────────┐
                │ 1. Each tester defect → GitHub     │
                │    issue with `user-testing` label │
                └────────────────────┬───────────────┘
                                     │
                ┌────────────────────▼───────────────┐
                │ 2. SDK lead triages within 24h     │
                │    Assigns severity + target ver   │
                └────────────────────┬───────────────┘
                                     │
        ┌────────────────────────────┼──────────────────────────────┐
        ▼                            ▼                              ▼
  ┌─────────────┐            ┌─────────────┐               ┌─────────────┐
  │  Critical   │            │   Major     │               │  Doc-only   │
  │             │            │             │               │             │
  │ Hold 1.0.0  │            │ Schedule    │               │ Merge       │
  │ Fix + retest│            │ 1.0.1       │               │ immediately │
  └──────┬──────┘            └──────┬──────┘               └──────┬──────┘
         │                          │                              │
         ▼                          ▼                              │
  ┌─────────────────────────────────────────────────┐               │
  │ 3. Each fix lands as a PR with:                 │               │
  │    - Reference to GH issue                      │               │
  │    - Regression test covering the defect        │               │
  │    - CHANGELOG.md entry under [Unreleased]      │◀──────────────┘
  └────────────────────┬────────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────────┐
  │ 4. Patch release process (see release.md)       │
  │    - Bump version in package.json               │
  │    - Move [Unreleased] → [1.0.1] in CHANGELOG   │
  │    - git tag v1.0.1                              │
  │    - pnpm publish                                │
  └─────────────────────────────────────────────────┘
```

## Issue Template

Every defect filed gets this body:

```markdown
**Source**: User testing tester #N, scenario X
**Severity**: Critical / Major / Minor / Doc-only
**Target release**: 1.0.0 / 1.0.1 / 1.0.x / 1.1.0

## Reproduction
1. ...
2. ...
3. Expected: ...
4. Actual: ...

## Tester quote (if any)
> ...

## Proposed fix
- [ ] ...
- [ ] Add regression test in `tests/...`
- [ ] Update `CHANGELOG.md` under [Unreleased]
```

## Patch Release Checklist (`1.0.1` and beyond)

Run after every batch of merged fixes:

- [ ] All linked issues closed
- [ ] All new tests passing (`pnpm jest`)
- [ ] Lint + typecheck clean (`pnpm lint && pnpm typecheck`)
- [ ] Build clean (`pnpm build`)
- [ ] Bundle size within budget (`pnpm size:check`)
- [ ] `CHANGELOG.md` — move `[Unreleased]` section to `[1.0.1]` with date
- [ ] `package.json` version bumped
- [ ] `git tag v1.0.1`
- [ ] `pnpm publish`
- [ ] GitHub release created with CHANGELOG excerpt
- [ ] Announce in the user-testing comms channel

## Communication

Each tester is emailed:
- When their issue is acknowledged (within 24h)
- When the fix lands on `main`
- When the patch release ships to npm

This keeps the testing experience professional and encourages reuse for future SDK versions.

