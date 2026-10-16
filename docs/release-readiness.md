# Release readiness — 2.0.0

## Next release: 2.0.1 (not published)

2.0.1 removes the peer upper bounds (RN `>=0.73.0`, React `>=18.2.0`) and
declares support for every stable RN release with the New Architecture from
0.76. RN 0.88.0, `latest` since 2026-10-15, was rejected by the 2.0.0 peer
range. Before publishing, repeat the [completed checklist](#completed-200-release-checklist)
against the 2.0.1 release SHA and archive, and also:

- [ ] Require a green `stable` run (RN 0.88.0 and 0.87.1) on the release SHA.
- [ ] Run and require a green manual `support` run (adds RN 0.82.1, 0.78.3 and
  0.76.9, including the first `macos-15` / Xcode 16.4 iOS lanes).
- [ ] Confirm the release monitor passes and npm `latest` is still covered.
- [ ] Verify a clean RN 0.88.0 consumer installs the registry archive with plain
  `npm install` (no `--legacy-peer-deps`).

Pre-commit local lane evidence is recorded in
[native compatibility](native-compatibility.md#201-local-lane-evidence).

## Publication status

Verified on **2026-10-15** against the public npm registry and GitHub:

| Item | Status |
| --- | --- |
| Repository / published version | `2.0.0` |
| Release source commit | [`aad8cb9a529b3f85534562d399692b6aa572a6bd`](https://github.com/marcocrupi/react-native-keep-awake-plus/commit/aad8cb9a529b3f85534562d399692b6aa572a6bd) |
| JavaScript CI on the release commit | [38797203610 — success](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38797203610) |
| Stable Android/iOS CI on the release commit | [38797203699 — success](https://github.com/marcocrupi/react-native-keep-awake-plus/actions/runs/38797203699), all four RN/platform lanes and required-native gate |
| GitHub tag / Release | [v2.0.0](https://github.com/marcocrupi/react-native-keep-awake-plus/releases/tag/v2.0.0), annotated tag at the release commit; public stable release |
| npm version / latest | [2.0.0](https://www.npmjs.com/package/@marcocrupi/react-native-keep-awake-plus/v/2.0.0) / `2.0.0` |
| Published archive SHA-256 | `c0accc7172e5da7ada31b499e512a866e75ded8c13952a4eed948ac313b4926d` |
| Registry download / clean consumer | Download byte-identical to the verified archive; all 28 installed files and lock SHA-512 integrity match |

The reviewed archive was published directly, without repacking after its dry run.
npm accepted the upload, then completed its asynchronous processing before the
registry download and clean-consumer checks above. The release tag remains at
`aad8cb9`; this publication-status update and the changelog date are later
repository documentation changes, not changes to the published npm archive.
The archive's changelog has an undated `2.0.0` heading.

Exact SHA-512 integrity, member hashes, validation exits, audit JSON, consumer
locks and downloaded archive are retained outside the repository in
`.codex-evidence/keep-awake-npm-2.0.0/` (relative to the repository's parent).
No physical-device or new OS-runtime qualification was performed in this
publication phase. Recheck mutable registry and GitHub status before a later release.

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
publication/remote-CI status is historical and is superseded by the release
checks above. Keep those reports unchanged as evidence.

### Archive provenance and documentation changes

The local native/runtime campaign built an initial archive. The final archive
then excluded an unused Gradle fixture and changed changelog/allowlist metadata.
Independent review proved all production JS/native/type/build inputs identical;
the final container was reinstalled and verified but not freshly rebuilt/run.
Runtime PASS transfers by production-input equivalence, not final-container
rebuild identity. Consult the external review for the detailed comparison.

README, CHANGELOG and MIGRATION are distributed files. Documentation edits change
their bytes, so a new archive has a new digest/integrity even when APIs and
production sources are unchanged. Do not reuse an earlier archive hash as the
current publication identity. Repack, inspect and retain the final archive plus a comparison of its
production inputs. `docs/`, `example/`, iOS harnesses, reports and temporary
fixtures must not enter the package; existing Java regression sources are
intentionally distributed for archive-consumer native host tests.

## Compatibility and runtime limits

2.0.0 published the peer range `>=0.73.0 <0.88.0`; only the exact stable
versions above had remote qualification at that time. From 2.0.1 the range is
uncapped; see the [support policy](native-compatibility.md#support-policy).
Historical RN 0.73.11 checks and Old Architecture evidence do not qualify every
peer or 2.0.0 runtime.

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
The publication refresh on 2026-10-15 also exited 1 in both projects: root
reported 9 high nodes and example 49; the only direct advisory remained `braces`
GHSA-vfj7-8cjw-p6xm. Raw JSON and exits are retained in the external publication
evidence directory above. The residual remains disclosed in the public release notes.
Always recheck the current graph before publishing; do not suppress
findings to make the checklist green. The package has no runtime npm dependencies;
consumer graphs and their risk assessment remain separate.

## Completed 2.0.0 release checklist

- [x] Checked npm versions/dist-tags, GitHub tags/releases and remote main before publication.
- [x] Reviewed source/version/peer metadata, documentation, retained technical review,
  runtime provenance and residual security finding. No production inputs changed.
- [x] Ran clean root/example installs, both typechecks, zero-warning example lint,
  36 Jest tests and package/native-CI/podspec contracts. Recorded nonzero audits
  and the disclosed residual above.
- [x] Committed/pushed the reviewed documents; required successful JavaScript and
  stable native CI on release SHA `aad8cb9`.
- [x] Packed and inspected the final archive outside the repository; recorded
  SHA-256, SHA-512 integrity and all 28 member hashes. Verified checkout and
  installed-consumer bytes plus lock integrity.
- [x] Compared the archive with the independently qualified 2.0.0 archive:
  identical membership and all production/build/Codegen inputs; only README,
  CHANGELOG and MIGRATION bytes differ. Retained the comparison proof.
- [x] Published only after a successful npm publication dry run of that exact archive.
- [x] Prepared public release notes with breaking changes, migration, exact CI links,
  compatibility/runtime limits and the security residual.
- [x] Published the exact reviewed archive with public access; verified version,
  `latest`, integrity, byte-identical registry download and a clean registry consumer.
- [x] Created/pushed annotated `v2.0.0` at the release SHA and published the stable
  GitHub Release. Updated repository publication status and changelog date afterward.

For later releases, repeat these checks against the new release SHA and archive.
Do not regenerate an archive between review/dry run/publication or move a
published release tag to a later documentation commit.
