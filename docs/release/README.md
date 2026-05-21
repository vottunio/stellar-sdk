# Release Documentation

Operational guides for taking `@wirex/stellar-sdk` from `1.0.0-rc` to a tagged production release.

| Document | Phase | Owner |
|---|---|---|
| [user-testing-protocol.md](./user-testing-protocol.md) | 3.4.5 | Puneet (moderator) — runs 3 external developer sessions per the protocol |
| [feedback-workflow.md](./feedback-workflow.md) | 3.4.6 | Puneet (triage) — defects → issues → patch release |
| [release.md](./release.md) | 3.4.7 | Puneet (publisher) — npm publish + git tag + GitHub release |
| [mainnet-proof.md](./mainnet-proof.md) | 3.4.8 | Puneet (signer) — single 0.0001 XLM mainnet tx for SCF acceptance |

## Acceptance Sign-off Order

For SCF #41 Tranche 3 acceptance, the gates are executed in this order:

```
1. Code freeze on main (release-candidate)
2. Run user-testing-protocol.md
3. Triage defects via feedback-workflow.md
4. Critical fixes land → re-verify quality gates
5. Run release.md (npm publish 1.0.0)
6. Run mainnet-proof.md
7. Publish user-testing-report.md + mainnet-proof-record.md
8. Submit to SCF
```

All four docs assume you've already run the Phase 3.1–3.3 work, which is automated and complete. These four are the **human-loop** tasks.
