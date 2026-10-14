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
imperative-clear witnesses. The test setter is restored at completion.

A minimal UIKit host can use real React Native base headers with
`RCT_NEW_ARCH_ENABLED=0`, `RCT_DISABLE_STATIC_MODULE_REGISTRATION=1`,
`RCT_REMOTE_PROFILE=0` and `RCT_ENABLE_INSPECTOR=0`, linking Foundation and UIKit.
This **native host** does not qualify React Native registration or TurboModules.
A React Native application host can instead compile with its real Codegen spec.

For the LIF-02 integration campaign, isolated copies of the approved EX-01 scene
app use RN 0.85.3 and 0.87.1 with clean Pods, generated SpecJSI, Hermes and
bridgeless RCTHost. The fixture creates independent hosts and parks a genuine
native invocation while a successor host starts; real host release triggers
RCTTurboModuleManager invalidation. Instrumentation forwards original methods
and observes UIKit; it does not replace the module. Declarative component/hook
ownership, background/foreground and surface recreation are exercised separately.

Reproducible fixture generators, commands with raw exits, mutation sources,
results and device identities are retained with the LIF-02 runtime report. Tests
are deliberately outside the podspec's `ios/*.{h,m,mm}` source glob and do not
ship in the library target.
