# Release readiness — 2.0.0

## Contract and release boundary

The candidate version is **2.0.0** in the root manifest/lock and example's local
package metadata. The intentional breaking change is shared ownership for every
public API; imperative last-call-wins is removed. See [migration](../MIGRATION.md).
Root functions and Class statics each hold a distinct idempotent implicit request.
Hook/component/token/Class instance owners are independent. Only first acquisition
and final release request native transitions within one JS runtime. No native
rewrite, runtime dependency, React Native upgrade or peer-range change is needed.

All changes remain unstaged on main. This checklist does not publish a release.
The local command ledger, raw logs, archive, physical RN 0.87.1 consumer, runtime
proof and independent review are kept outside the repository in
`../.codex-evidence/keep-awake-2.0.0/REPORT.md`. Consult its exact final statuses,
candidate fingerprint and tarball hash before publication. Historical P0–P2
proof is retained separately and does not qualify the new imperative semantics.

## Required verification

- Clean root/example `npm ci`, both typechecks, zero-warning lint and Jest API
  regression tests, including StrictMode, enabled, implicit request identity,
  token ordering, missing native modules and synchronous native failures.
- Package checker/contracts, native-ci contracts and effective iOS podspec
  checker/contracts. Preserve native implementation and dependency graph.
- Physical `npm pack` archive: exact 2.0.0 metadata, all source bytes and installed
  bytes match, lock SHA-512 integrity, migration guide included, no test harness,
  temporary files or credentials. Run `npm publish --dry-run` on that archive.
- Real RN 0.87.1 New Architecture archive consumer: autolinking, Codegen, Android
  host tests plus Debug/Release applications, iOS simulator compilation.
- Android integrated OS `FLAG_KEEP_SCREEN_ON` and iOS actual
  `UIApplication.idleTimerDisabled` sequences with mixed owners and imperative
  releases. A build alone cannot qualify runtime. iOS diagnostics belong only in
  the external consumer, never the published library.
- Post-GREEN self-audit, causal mutation witnesses, revalidation and independent
  read-only review of the exact final candidate/tarball/proof. Open material
  findings or missing mandatory runtime evidence prevent release-ready status.

## Compatibility and qualification limits

New Architecture first: RN 0.86.3/0.87.1 are the established native CI lanes;
0.85.3 remains the example/manual regression anchor. Baseline GitHub results
linked in the README cover `0d4fbfa`, not the unstaged 2.0.0 changes. Require
remote CI on the eventual release commit. Other peer versions and Old Architecture
are not newly qualified; peers remain `>=0.73.0 <0.88.0`.

AGP 9 new DSL **NOT QUALIFIED / UPSTREAM BLOCKED**: the verified true/true probe
fails applying the unchanged RN 0.87.1 template Kotlin plugin. Stable
`android.newDsl=false` / `android.builtInKotlin=false` remains supported by the
existing evidence. Do not infer new-DSL support from opt-out builds. See
[compatibility](native-compatibility.md#agp-9-new-dsl-probe).

Emulator/simulator smoke does not establish physical-device/store signing,
same-process iOS scene reconnection, every OS version, or behavior of third-party
writers to the same flag. No new cross-runtime guarantee is attributed to JS;
existing native coordination is preserved. Keep intent separate from observed OS
state. No public async status API is implemented: acknowledgement versus sampled
flag, UI-thread/lifecycle/invalidation semantics and unavailable/error results
require a separate product/native contract.

## Security

SEC-01 remains closed with a documented residual development-tooling `braces`
GHSA-vfj7-8cjw-p6xm advisory. No compatible upstream remediation was confirmed in
the previous assessment. Re-run root/example audits before publication; a nonzero
audit is not a clean result. No audit suppression or dependency upgrade is part
of this ownership change. The package has no runtime npm dependencies; consumers
resolve their own RN/tooling graph.

## Manual publication after review

1. Inspect the external final report/review, exact fingerprint, unstaged diff,
   archive SHA-256 and security residual. Resolve any material finding.
2. Run the quality gates above on any changed release input. Stage/commit/push
   manually only after maintainer approval; no task automation does these steps.
3. Require JS and stable Android/iOS native CI on the exact pushed commit;
   optionally dispatch the separate 0.85.3 anchor. CI remains necessary even
   when local smoke passes. No branch-protection change is needed here.
4. Inspect `npm publish --dry-run /ABS/VERIFIED_ARCHIVE.tgz --access public` and
   ensure the bytes match the reviewed archive. Publish that exact archive only
   after explicit maintainer approval; do not regenerate silently after review.
5. Manually create tag `v2.0.0` and GitHub Release following maintainer policy,
   linking changelog/migration and actual CI evidence. No tag, GitHub Release or
   real npm publication is authorized for this automated task.
