// Hosted by a real UIKit application. Compile this file with the production
// ReactNativeKCKeepAwake.mm; no UIApplication or owner-state mocks are used.
#import "../ReactNativeKCKeepAwake.h"
#import <UIKit/UIKit.h>
#import <React/RCTInvalidating.h>
#import <objc/runtime.h>

@interface ReactNativeKCKeepAwake (LifecycleTestMethods)
- (void)activate;
- (void)deactivate;
@end

static NSMutableArray<NSDictionary *> *results;
static NSMutableArray<NSNumber *> *writes;
static void (^beforeWrite)(BOOL);
static IMP originalSetter;
static BOOL allWritesOnMain;
static NSString *caseName;

static void Check(BOOL condition, NSString *detail) {
  [results addObject:@{@"case": caseName, @"pass": @(condition), @"detail": detail,
                      @"idleTimerDisabled": @([UIApplication sharedApplication].idleTimerDisabled),
                      @"writes": [writes copy], @"pid": @(NSProcessInfo.processInfo.processIdentifier)}];
}
static void Revoke(id module) {
  if ([module respondsToSelector:@selector(invalidate)]) {
    [(id<RCTInvalidating>)module invalidate];
  }
}
// More than one turn is intentional: a reentrant write can enqueue a corrective
// reconciliation while the first drain is in flight.
static void Drain(int turns, void (^done)(void)) {
  dispatch_async(dispatch_get_main_queue(), ^{
    if (turns) Drain(turns - 1, done); else done();
  });
}
static void Begin(NSString *name) {
  caseName = name; [writes removeAllObjects]; beforeWrite = nil;
}
static BOOL Idle(void) { return UIApplication.sharedApplication.idleTimerDisabled; }

void KCKeepAwakeRunLifecycleTests(void (^completion)(NSArray<NSDictionary *> *)) {
  NSCAssert(NSThread.isMainThread, @"UIKit test host must run on main");
  results = [NSMutableArray new]; writes = [NSMutableArray new]; allWritesOnMain = YES;
  Method setter = class_getInstanceMethod(UIApplication.class, @selector(setIdleTimerDisabled:));
  IMP testSetter = imp_implementationWithBlock(^(UIApplication *app, BOOL value) {
    allWritesOnMain &= NSThread.isMainThread;
    void (^hook)(BOOL) = beforeWrite; beforeWrite = nil;
    if (hook) hook(value);
    ((void (*)(id, SEL, BOOL))originalSetter)(app, @selector(setIdleTimerDisabled:), value);
    [writes addObject:@(app.idleTimerDisabled)];
  });
  originalSetter = method_setImplementation(setter, testSetter);
  __block ReactNativeKCKeepAwake *a, *b;
  __block void (^next)(void);
  __block NSUInteger index = 0;
  NSMutableArray<void (^)(void)> *cases = [NSMutableArray new];

  [cases addObject:^{
    Begin(@"queued activate then deactivate"); a = [ReactNativeKCKeepAwake new];
    [a activate]; [a deactivate];
    Drain(6, ^{ Check(!Idle() && ![writes containsObject:@YES], @"No obsolete YES during drain"); Revoke(a); a = nil; next(); });
  }];
  [cases addObject:^{
    Begin(@"queued activate then invalidate"); a = [ReactNativeKCKeepAwake new];
    [a activate]; Revoke(a);
    Drain(6, ^{ Check(!Idle() && ![writes containsObject:@YES], @"Revocation precedes main application"); a = nil; next(); });
  }];
  [cases addObject:^{
    Begin(@"active module destruction"); a = [ReactNativeKCKeepAwake new]; [a activate];
    Drain(6, ^{ Check(Idle(), @"Activation applied before destruction"); __weak id weak = a; a = nil;
      Check(weak == nil, @"Pending work does not retain module");
      Drain(6, ^{ Check(!Idle(), @"Last owner dealloc restores idle timer"); next(); }); });
  }];
  [cases addObject:^{
    Begin(@"post invalidate and double revoke"); a = [ReactNativeKCKeepAwake new];
    Check([a respondsToSelector:@selector(invalidate)] && [a conformsToProtocol:@protocol(RCTInvalidating)], @"RCTInvalidating lifecycle adopted");
    [a activate]; Revoke(a); Revoke(a); [a activate]; [a deactivate]; [a activate];
    Drain(6, ^{ Check(!Idle() && ![writes containsObject:@YES], @"Invalidation is terminal and idempotent"); a = nil; next(); });
  }];
  [cases addObject:^{
    Begin(@"two independent native owners"); a = [ReactNativeKCKeepAwake new]; b = [ReactNativeKCKeepAwake new];
    [a activate]; [b activate];
    Drain(6, ^{ Check(Idle(), @"Both modules own UIApplication"); [a deactivate];
      Drain(6, ^{ Check(Idle(), @"Deactivate A preserves B"); Revoke(a);
        Drain(6, ^{ Check(Idle(), @"Invalidate A preserves B"); Revoke(b);
          Drain(6, ^{ Check(!Idle(), @"Last valid owner released"); a = nil; b = nil; next(); }); }); }); });
  }];
  [cases addObject:^{
    Begin(@"repeated acquisition and release"); a = [ReactNativeKCKeepAwake new]; b = [ReactNativeKCKeepAwake new];
    for (int i=0;i<100;i++) [a activate]; [b activate];
    for (int i=0;i<100;i++) [a deactivate]; Revoke(a); Revoke(a);
    Drain(6, ^{ Check(Idle(), @"Repeated A releases cannot decrement B"); Revoke(b);
      Drain(6, ^{ Check(!Idle(), @"Repeated activates acquire once"); a=nil; b=nil; next(); }); });
  }];
  [cases addObject:^{
    Begin(@"concurrent updates and invalidation"); a = [ReactNativeKCKeepAwake new]; b = [ReactNativeKCKeepAwake new]; [b activate];
    dispatch_group_t group = dispatch_group_create();
    for (int j=0;j<8;j++) dispatch_group_async(group, dispatch_get_global_queue(QOS_CLASS_DEFAULT,0), ^{
      for (int i=0;i<500;i++) { [a activate]; [a deactivate]; }
    });
    dispatch_group_async(group, dispatch_get_global_queue(QOS_CLASS_DEFAULT,0), ^{ Revoke(a); });
    dispatch_group_notify(group, dispatch_get_main_queue(), ^{
      [a activate]; Revoke(a);
      Drain(6, ^{ Check(Idle(), @"Concurrent revoked A preserves B"); Revoke(b);
        Drain(6, ^{ Check(!Idle(), @"No lost update or owner leak after concurrent calls"); a=nil;b=nil;next(); }); });
    });
  }];
  [cases addObject:^{
    Begin(@"late old owner during successor activation"); a = [ReactNativeKCKeepAwake new]; [a activate]; Revoke(a);
    b = [ReactNativeKCKeepAwake new]; [b activate]; [a deactivate]; [a activate]; Revoke(a);
    Drain(6, ^{ Check(Idle(), @"Old owner cannot clear successor"); Revoke(b); [a activate];
      Drain(6, ^{ Check(!Idle(), @"Old callback cannot resurrect after successor release"); a=nil;b=nil;next(); }); });
  }];
  [cases addObject:^{
    Begin(@"imperative clear without acquisition"); a = [ReactNativeKCKeepAwake new];
    UIApplication.sharedApplication.idleTimerDisabled = YES; [writes removeAllObjects]; [a deactivate];
    Drain(6, ^{ Check(!Idle(), @"Legacy clear repairs unowned UIKit state"); b=[ReactNativeKCKeepAwake new]; [b activate];
      Drain(6, ^{ [a deactivate];
        Drain(6, ^{ Check(Idle(), @"Unacquired A cannot clear library owner B"); Revoke(a); Revoke(b); a=nil;b=nil;Drain(6,next); }); }); });
  }];
  [cases addObject:^{
    Begin(@"reentrant UIKit transition"); a=[ReactNativeKCKeepAwake new];
    beforeWrite = ^(BOOL value) {
      Check(value, @"Intercepted real activation setter");
      dispatch_semaphore_t sem=dispatch_semaphore_create(0);
      dispatch_async(dispatch_get_global_queue(QOS_CLASS_DEFAULT,0), ^{ Revoke(a); [a activate]; dispatch_semaphore_signal(sem); });
      Check(dispatch_semaphore_wait(sem,dispatch_time(DISPATCH_TIME_NOW, NSEC_PER_SEC))==0, @"No internal lock across UIKit; background revoke returns");
    };
    [a activate];
    Drain(8, ^{ Check(!Idle(), @"In-flight write reconciles reentrant terminal state"); a=nil;next(); });
  }];
  [cases addObject:^{
    Begin(@"deallocation during UIKit with successor"); a=[ReactNativeKCKeepAwake new]; b=[ReactNativeKCKeepAwake new];
    beforeWrite=^(BOOL value) { a=nil; [b activate]; };
    [a activate];
    Drain(8, ^{ Check(Idle(), @"Dealloc in setter does not deadlock or lose successor"); Revoke(b); b=nil;
      Drain(6, ^{ Check(!Idle(), @"Successor final release clears"); next(); }); });
  }];
  [cases addObject:^{
    Begin(@"pending work and resource release"); a=[ReactNativeKCKeepAwake new]; __weak id weak=a;
    [a activate]; a=nil;
    Check(weak==nil,@"Queued activation holds no strong module reference");
    Drain(6, ^{ Check(!Idle() && ![writes containsObject:@YES],@"Destroyed pending owner never activates"); next(); });
  }];
  [cases addObject:^{
    Begin(@"concurrent calls followed by final deactivate"); a=[ReactNativeKCKeepAwake new];
    dispatch_group_t group=dispatch_group_create();
    for(int j=0;j<6;j++) dispatch_group_async(group,dispatch_get_global_queue(QOS_CLASS_DEFAULT,0),^{
      for(int i=0;i<250;i++) { [a deactivate]; [a activate]; }
    });
    dispatch_group_notify(group,dispatch_get_main_queue(),^{ [a deactivate];
      Drain(8,^{ Check(!Idle(),@"Final joined deactivate wins all concurrent earlier calls"); Revoke(a);a=nil;next(); });
    });
  }];
  [cases addObject:^{
    Begin(@"same-thread reentrant release"); a=[ReactNativeKCKeepAwake new]; b=[ReactNativeKCKeepAwake new];
    beforeWrite=^(BOOL value){ [a deactivate]; Revoke(a); [a activate]; [b activate]; };
    [a activate];
    Drain(8,^{ Check(Idle(),@"Reentrant revoke and successor do not deadlock"); Revoke(b);
      Drain(6,^{ Check(!Idle(),@"Reentrant invalid owner cannot resurrect");a=nil;b=nil;next(); }); });
  }];
  [cases addObject:^{
    Begin(@"main thread invariant"); Check(allWritesOnMain,@"Every observed UIKit write runs on main");
    method_setImplementation(setter,originalSetter); beforeWrite=nil;
    Check(imp_removeBlock(testSetter),@"UIKit test interceptor resources released");
    next();
  }];
  next=^{
    if(index<cases.count) { UIApplication.sharedApplication.idleTimerDisabled=NO; cases[index++](); }
    else { NSArray *output=[results copy]; void (^done)(NSArray *)=completion; NSMutableArray *releaseCases=cases; [releaseCases removeAllObjects]; next=nil; done(output); }
  };
  next();
}
