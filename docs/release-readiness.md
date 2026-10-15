# Release readiness — 2.0.0

## Publication status

Verified on **2026-10-15** against the public registry and GitHub APIs:

| Item | Status |
| --- | --- |
| Repository version | `2.0.0` in package.json, root lock and example local-package metadata |
| Published implementation commit on main | [`71cb67772c43cdebf265df74f274d1ad9c6132d5`](https://github.com/marcocrupi/react-native-keep-awake-plus/commit/71cb67772c43cdebf265df74f274d1ad9c6132d5) |
| JavaScript CI on that commit | [38769209285 — success](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38769209285) |
| Stable Android/iOS CI on that commit | [38769209447 — success](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38769209447) |
| Latest GitHub tag / Release | [v1.6.1](https://github.com/marcocrupi/react-native-keep-awake-plus/releases/tag/v1.6.1) |
| npm latest / highest published version | [1.6.1](https://www.npmjs.com/package/@marcocrupi/react-native-keep-awake-plus); registry contains 1.5.0, 1.6.0, 1.6.1 |
| npm 2.0.0 | **Not published** |
| GitHub tag / Release 2.0.0 | **Not created** |

2.0.0 is prepared in source; it is not a published release. Recheck these mutable
facts before publication. Documentation revisions after this commit are separate
release inputs, even though they do not change APIs. No publication, tag or remote
workflow dispatch is performed by the DOC-02 documentation task.

## Contract and evidence

2.0.0 deliberately replaces imperative last-call-wins with shared ownership.
Root functions and Class statics hold distinct idempotent implicit requests;
hooks, components, Class instances and tokens hold independent owners. Only the
first JS owner and last release request native transitions. See
[migration](../MIGRATION.md) and [API reference](../README.md#api-reference).

The remote JS workflow checks package/types, example typecheck, lint and Jest.
The remote native workflow checks stable RN 0.86.3/0.87.1 New Architecture archive
consumers: Codegen, Android host lifecycle tests and Debug/Release arm64 builds,
iOS Pods/Codegen and arm64 simulator compilation. **Neither workflow runs OS
runtime tests on an emulator, simulator or physical device.** RN 0.85.3 is a
separate manual anchor, not covered by a stable selection.

Separate local 2.0.0 evidence, retained outside the repository, records:

- RN 0.87.1 physical archive installation, byte comparison, lock SHA-512 integrity,
  types and autolinking; Android Codegen, 44 host tests and Debug/Release APKs;
  iOS New Architecture Pods/Codegen and simulator compilation.
- Android API 36 emulator mixed-owner OS Window checks: 32 phases, three samples
  each. iOS 26.5 simulator checks: 95 actual main-thread idle-timer reads over
  33 phases. Artifact/process identity and raw observations were reviewed.
- 36 JavaScript tests, TypeScript/lint/package/native-CI/podspec contracts and
  mutation witnesses; independent review approved with no material finding.

These are retained campaign results, not reruns during DOC-02. The technical
report and independent review are in the sibling evidence directory
`.codex-evidence/keep-awake-2.0.0/REPORT.md` and `REVIEW.md` (relative to the
repository's parent). They describe the then-unstaged candidate based on
`0d4fbfa`; that implementation is now committed as `71cb677`. Their old
publication/remote-CI status is historical and is superseded by the public
checks above. Keep those reports unchanged as evidence.

### Archive provenance and documentation changes

The local native/runtime campaign built an initial archive. The final archive
then excluded an unused Gradle fixture and changed changelog/allowlist metadata.
Independent review proved all production JS/native/type/build inputs identical;
the final container was reinstalled and verified but not freshly rebuilt/run.
Runtime PASS transfers by production-input equivalence, not final-container
rebuild identity. Consult the external review for the detailed comparison.

README, CHANGELOG and MIGRATION are distributed files. DOC-02 changes their bytes,
so a new archive has a new digest/integrity even when APIs and production sources
are unchanged. Do not reuse an earlier archive hash as the current publication
identity. Repack, inspect and retain the final archive plus a comparison of its
production inputs. `docs/`, `example/`, iOS harnesses, reports and temporary
fixtures must not enter the package; existing Java regression sources are
intentionally distributed for archive-consumer native host tests.

## Compatibility and runtime limits

The peer range `>=0.73.0 <0.88.0` permits npm resolution; only the exact stable
versions above have current remote qualification. Historical RN 0.73.11 checks
and Old Architecture evidence do not qualify every peer or 2.0.0 runtime.

AGP 9 with the official RN 0.87.1 template's `android.newDsl=false` and
`android.builtInKotlin=false` is covered. True/true is **NOT QUALIFIED / UPSTREAM
BLOCKED** by the verified unchanged-template Kotlin extension conflict, before
package compilation. See [AGP probe](native-compatibility.md#agp-9-new-dsl-probe).

Physical devices, store signing, every OS/peer combination and same-process iOS
scene reconnection remain unqualified. Existing native multi-runtime lifecycle
evidence is separate from JS ownership tests. Calls request intent; there is no
public asynchronous OS-status API and no absolute isolation from external flag
writers. See [native evidence](native-compatibility.md#runtime-evidence-and-limits).

## Security

The previous SEC-01 campaign closed its remediation scope with a residual
[`braces` GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
development-tooling advisory. Its root/example full audits exited 1; a nonzero
audit is not clean. No compatible upstream remediation was confirmed in that
assessment. A DOC-02 refresh on 2026-10-15 again exited 1 in both projects:
root reported 9 high nodes and example 50, all propagating the same direct
`braces` advisory. Raw JSON/exits are retained in the external DOC-02 report.
Always recheck the current graph before publishing; do not suppress
findings to make the checklist green. The package has no runtime npm dependencies;
consumer graphs and their risk assessment remain separate.

## Manual release checklist

These are maintainer actions after review, not authorization for automation:

- [ ] **2.0.0 is not yet published.** Recheck npm dist-tags/version list, GitHub
  tags/releases and remote main; update status only from verified results.
- [ ] Review the documentation diff, source/version/peer metadata, external
  technical report, independent review, runtime provenance and residual security
  finding. Resolve material findings before release.
- [ ] Run root/example clean installs, both typechecks, zero-warning example lint
  and Jest; run package/native-CI/podspec contracts with the required Ruby/RN
  setup. Refresh root/example audits and record any accepted residual findings.
- [ ] Have the maintainer commit/push the reviewed documentation. Require JS and
  stable native CI on the final release SHA. Existing `71cb677` CI qualifies
  that implementation, not a later archive byte identity.
- [ ] Pack the final checkout to a new external directory. Inspect README,
  CHANGELOG, MIGRATION and every member; exclude diagnostics/fixtures/credentials.
  Record SHA-256, npm SHA-512 integrity, source/installed byte identity and locks.
- [ ] Compare production/build/Codegen inputs with qualified inputs. Repeat
  relevant native/runtime checks if those inputs changed; do not silently
  transfer earlier results to changed code. Retain exact archives and proof.
- [ ] Run `npm publish --dry-run /ABS/VERIFIED_ARCHIVE.tgz --access public` and
  review name, version, contents and integrity. This is only a dry run.
- [ ] Prepare public release notes from CHANGELOG/MIGRATION with the major change,
  exact CI links, compatibility limits and security residual. Set the release
  date only when the actual release occurs.
- [ ] Publish the exact reviewed archive manually with public access. Verify
  registry version, dist-tag, integrity and a clean consumer installation.
- [ ] Create/push `v2.0.0` at the approved release SHA and create the corresponding
  GitHub Release manually. The podspec source tag must resolve to that revision.
  Verify release notes and downloads, then update publication status in docs.

Do not silently regenerate the archive between review/dry run/publication.
Publication, tag creation, GitHub Release and final status updates are distinct
steps; none is implied by a successful commit or CI run.
