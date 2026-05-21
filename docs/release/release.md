# Release Checklist — `v1.0.0` (Tranche 3.4.7)

Step-by-step procedure for publishing `@wirex/stellar-sdk@1.0.0` to npm and tagging the GitHub release.

---

## Pre-flight (do these first)

The repo is already configured for publishing — these are the **verifications**, not setup steps:

- [x] `package.json#version` = `1.0.0`
- [x] `package.json#name` = `@wirex/stellar-sdk` (scoped, public)
- [x] `package.json#publishConfig.access` = `public`
- [x] `package.json#publishConfig.provenance` = `true`
- [x] `package.json#sideEffects` = `false`
- [x] `package.json#files` whitelist: `["dist", "README.md", "CHANGELOG.md", "LICENSE"]`
- [x] `LICENSE` file present (MIT)
- [x] `CHANGELOG.md` has a `[1.0.0]` section
- [x] `README.md` present at root

## Quality Gates

Run **all** of these from a clean checkout — they must all pass:

```bash
nvm use 22                                       # Node 22 (CI parity)
pnpm install --frozen-lockfile
pnpm typecheck                                   # 0 errors
pnpm lint                                        # 0 errors (warnings OK)
pnpm jest tests/unit/ --coverage                 # all green, ≥80% in all 4 metrics
pnpm jest tests/e2e/ --testTimeout=240000        # all green against live testnet
pnpm clean && pnpm build                         # produces dist/{esm,cjs,umd,types}
pnpm size:check                                  # all bundles within budget
pnpm docs                                        # TypeDoc generates docs/api/
```

Expected sizes (gzipped): **ESM 36 KB, CJS 36 KB, UMD 17 KB**.

## Pre-publish Dry Run

```bash
pnpm publish --dry-run
```

Inspect the output. Confirm:
- Tarball name is `wirex-stellar-sdk-1.0.0.tgz`
- Total size is < 5 MB
- Files included: `dist/**`, `README.md`, `CHANGELOG.md`, `LICENSE`, `package.json`
- **No** test files, source `.ts` files, examples, or `node_modules` included

## Authenticate with npm

```bash
npm whoami                                       # confirm you're the right user
npm login --scope=@wirex --registry=https://registry.npmjs.org/
```

You must have **publish access to the `@wirex` scope** on the npm registry. If the scope doesn't exist yet, create it first:

```bash
# Run as the Vottun npm org owner
npm org create @wirex
npm org set @wirex <vottun-publisher-account> admin
```

## Publish

```bash
pnpm publish --access public
```

This runs `prepublishOnly` (clean + build) automatically, then uploads the tarball. With `provenance: true`, npm publishes a build attestation linking the package to its source commit.

After it succeeds, verify:

```bash
npm view @wirex/stellar-sdk version              # → 1.0.0
npm view @wirex/stellar-sdk dist-tags            # → { latest: '1.0.0' }
npm view @wirex/stellar-sdk repository.url       # → git+https://github.com/vottunio/stellar-sdk.git
```

## Tag the GitHub Release

```bash
git tag -a v1.0.0 -m "Wirex Stellar SDK 1.0.0 — initial mainnet release"
git push origin v1.0.0
```

Then on GitHub: **Releases → Draft a new release → Choose tag `v1.0.0`**:

- **Title**: `v1.0.0 — Initial mainnet release`
- **Body**: paste the `[1.0.0]` section from `CHANGELOG.md`
- **Set as the latest release**: ✓
- **Set as a pre-release**: ✗

## Verify CDN

After publish, both CDNs should serve the UMD bundle automatically:

```
https://unpkg.com/@wirex/stellar-sdk@1.0.0/dist/umd/wirex-sdk.umd.js
https://cdn.jsdelivr.net/npm/@wirex/stellar-sdk@1.0.0/dist/umd/wirex-sdk.umd.js
```

Verify both URLs return HTTP 200 and the same content size as the local build.

## Smoke Test the Published Package

In a **fresh directory** (not the repo):

```bash
mkdir /tmp/sdk-smoke && cd /tmp/sdk-smoke
pnpm init -y
pnpm add @wirex/stellar-sdk@1.0.0
cat > smoke.mjs <<'EOF'
import { WirexSDK } from '@wirex/stellar-sdk';
const sdk = new WirexSDK({ network: 'testnet' });
const w = sdk.wallet.create();
console.log('OK:', w.publicKey);
EOF
node smoke.mjs                                   # should print "OK: G..."
```

If this fails, **unpublish within 72h** and investigate:

```bash
npm unpublish @wirex/stellar-sdk@1.0.0           # only available within 72h of publish
```

## Post-release

- [ ] Announce internally (Vottun + Wirex Slack)
- [ ] Update `docs/release/release.md` with the actual publish timestamp
- [ ] Open milestones for `1.0.1` (any patches from user testing) and `1.1.0` (next minor)
- [ ] Capture the [mainnet transaction proof](./mainnet-proof.md) — SCF acceptance criterion 3.4.8
- [ ] Mark `3.4.7` ✅ in `PLAN.md`
