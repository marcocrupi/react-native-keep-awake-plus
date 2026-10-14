#if __has_include(<React/RCTBridgeModule.h>)
#import <React/RCTBridgeModule.h>
#elif __has_include("RCTBridgeModule.h")
#import "RCTBridgeModule.h"
#else
#import "React/RCTBridgeModule.h"
#endif

#if __has_include(<React/RCTInvalidating.h>)
#import <React/RCTInvalidating.h>
#else
#import "RCTInvalidating.h"
#endif

#if RCT_NEW_ARCH_ENABLED
#import "ReactNativeKCKeepAwakeSpec.h"
#endif

@interface ReactNativeKCKeepAwake : NSObject <RCTBridgeModule, RCTInvalidating>
@end

#if RCT_NEW_ARCH_ENABLED
@interface ReactNativeKCKeepAwake () <NativeKCKeepAwakeSpec>
@end
#endif
