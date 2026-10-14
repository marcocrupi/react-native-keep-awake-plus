#import "ReactNativeKCKeepAwake.h"
#import "UIKit/UIKit.h"
#include <mutex>

#if RCT_NEW_ARCH_ENABLED
#import "ReactNativeKCKeepAwakeSpec.h"
#endif


namespace {
// Owned by the module, never retained by the coordinator or a queued block.
struct KeepAwakeOwner {
    bool desired = false;
    bool invalidated = false;
};

struct KeepAwakeCoordinator {
    std::mutex mutex;
    size_t activeOwners = 0;
    bool scheduled = false;
    bool dirty = false;
};

KeepAwakeCoordinator &Coordinator()
{
    static KeepAwakeCoordinator coordinator;
    return coordinator;
}

void ScheduleReconciliation();

void Reconcile()
{
    auto &coordinator = Coordinator();
    bool desired;
    {
        std::lock_guard<std::mutex> lock(coordinator.mutex);
        desired = coordinator.activeOwners != 0;
        coordinator.dirty = false;
    }

    // UIKit can reenter native/lifecycle code. No state lock spans this call.
    // Concurrent revocation is immediate logically; an already in-flight UIKit
    // write is followed by another reconciliation, not synchronous cleanup.
    UIApplication.sharedApplication.idleTimerDisabled = desired;

    bool again;
    {
        std::lock_guard<std::mutex> lock(coordinator.mutex);
        again = coordinator.dirty;
        if (!again) coordinator.scheduled = false;
    }
    // Yield between writes, including reentrant writes, to avoid starving main.
    if (again) ScheduleReconciliation();
}

void ScheduleReconciliation()
{
    dispatch_async(dispatch_get_main_queue(), ^{ Reconcile(); });
}

void UpdateOwner(KeepAwakeOwner &owner, bool desired, bool invalidate)
{
    auto &coordinator = Coordinator();
    bool schedule = false;
    {
        std::lock_guard<std::mutex> lock(coordinator.mutex);
        if (owner.invalidated) return;

        if (owner.desired != desired) {
            if (desired) ++coordinator.activeOwners;
            else --coordinator.activeOwners;
            owner.desired = desired;
        }
        owner.invalidated = invalidate;

        // Repeated imperative calls still reconcile UIKit, even deactivate on
        // an unacquired instance. Valid owners from other runtimes take priority.
        coordinator.dirty = true;
        if (!coordinator.scheduled) {
            coordinator.scheduled = true;
            schedule = true;
        }
    }
    if (schedule) ScheduleReconciliation();
}
} // namespace

@implementation ReactNativeKCKeepAwake {
    KeepAwakeOwner _keepAwakeOwner;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

RCT_EXPORT_METHOD(activate)
{
    UpdateOwner(_keepAwakeOwner, true, false);
}

RCT_EXPORT_METHOD(deactivate)
{
    UpdateOwner(_keepAwakeOwner, false, false);
}

- (void)invalidate
{
    UpdateOwner(_keepAwakeOwner, false, true);
}

- (void)dealloc
{
    // Also revoke when an embedding host releases a module without an explicit
    // lifecycle callback. Do not message self or capture it during destruction.
    UpdateOwner(_keepAwakeOwner, false, true);
}

# pragma mark - New Architecture
#if RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeKCKeepAwakeSpecJSI>(params);
}
#endif

@end

