# iOS lifecycle regression witnesses

`KCKeepAwakeLifecycleTests.mm` exports
`KCKeepAwakeRunLifecycleTests(void (^)(NSArray<NSDictionary *> *))`.
Call it on main from a foreground **UIKit application** after connecting its
scene. Compile it alongside the production `ReactNativeKCKeepAwake.mm` with ARC
and C++17 or later. Each returned record contains `case`, `detail`, `pass`, PID,
the actual `UIApplication.idleTimerDisabled` and the actual setter trace.

The harness forwards every intercepted setter to real UIKit. It does not mock
UIApplication, module ownership or lifecycle. It invokes the production native
methods, tests real ARC deallocation via weak references, and controls main-queue
interleavings. Invalidation is tested separately from asynchronous UIKit cleanup.
There are terminal, concurrent, reentrant, repeated-call, successor and unowned
imperative-clear witnesses. The test setter is restored at completion. These witnesses invoke raw native
methods, including unowned native clears; they do not define the JS 2.0.0
`deactivateKeepAwake()` contract, which is a no-op without its implicit request.

A minimal UIKit host can use real React Native base headers with
`RCT_NEW_ARCH_ENABLED=0`, `RCT_DISABLE_STATIC_MODULE_REGISTRATION=1`,
`RCT_REMOTE_PROFILE=0` and `RCT_ENABLE_INSPECTOR=0`, linking Foundation and UIKit.
This **native host** does not qualify React Native registration or TurboModules.
A React Native application host can instead compile with its real Codegen spec.

The historical LIF-02 integration campaign used isolated copies of the approved
EX-01 scene app on RN 0.85.3 and 0.87.1 with clean Pods, generated SpecJSI, Hermes
and bridgeless RCTHost. The fixture created independent hosts and parked a genuine
native invocation while a successor host started; real host release triggered
RCTTurboModuleManager invalidation. Instrumentation forwarded original methods
and observed UIKit without replacing the module. Declarative component/hook
ownership, background/foreground and surface recreation were exercised separately.

Reproducible fixture generators, commands with raw exits, mutation sources,
results and device identities are retained with the LIF-02 runtime report. Tests
are deliberately outside the podspec's `ios/*.{h,m,mm}` source glob and do not
ship in the library target.

## Relationship to CI and 2.0.0

This file describes a native application-host harness, not an XCTest target that
runs automatically with `pod install` or `npm test`. The current native CI compiles
iOS archive consumers but does not invoke this harness or launch simulator apps.
The local 2.0.0 mixed-owner UIKit checks used a separate instrumented RN 0.87.1
consumer. They do not imply that every historical lifecycle witness was rerun.

Same-process scene disconnect/reconnect and physical-device qualification remain
unqualified. Keep native-host, real RCTHost, simulator runtime and build-only
results separate. See [native compatibility](../../docs/native-compatibility.md#runtime-evidence-and-limits)
and [release readiness](../../docs/release-readiness.md) for current evidence and
provenance. No diagnostic source from this harness is shipped in the pod or npm
archive.
