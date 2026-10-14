package com.sayem.keepawake;

import android.content.Intent;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;

final class KCKeepAwakeImpl extends BaseActivityEventListener implements LifecycleEventListener {
    public static final String NAME = "ReactNativeKCKeepAwake";

    private final ReactApplicationContext reactContext;
    final KCKeepAwakeCoordinator.Owner owner;
    // State uses GATE. RN listener APIs and their callbacks must run outside it.
    private boolean initialized;

    public KCKeepAwakeImpl(ReactApplicationContext reactContext) {
        this.reactContext = reactContext;
        owner = new KCKeepAwakeCoordinator.Owner(reactContext);
    }

    void initialize() {
        synchronized (KCKeepAwakeCoordinator.GATE) {
            if (owner.invalidated || initialized) return;
            initialized = true;
        }
        reactContext.addLifecycleEventListener(this);
        // Invalidation can finish before an in-flight registration returns. Its registering
        // thread must then remove that listener as well; no waiting on RN monitors is needed.
        if (removeListenersIfInvalidated()) return;
        reactContext.addActivityEventListener(this);
        if (removeListenersIfInvalidated()) return;
        synchronized (KCKeepAwakeCoordinator.GATE) {
            if (owner.invalidated) return;
            KCKeepAwakeCoordinator.register(this);
        }
        KCKeepAwakeCoordinator.dispatch();
    }

    private boolean removeListenersIfInvalidated() {
        synchronized (KCKeepAwakeCoordinator.GATE) {
            if (!owner.invalidated) return false;
        }
        reactContext.removeLifecycleEventListener(this);
        reactContext.removeActivityEventListener(this);
        return true;
    }

    public void activate() {
        KCKeepAwakeCoordinator.setDesired(this, true);
    }

    public void deactivate() {
        KCKeepAwakeCoordinator.setDesired(this, false);
    }

    void invalidate() {
        boolean removeListeners;
        synchronized (KCKeepAwakeCoordinator.GATE) {
            if (owner.invalidated) return;
            // Revoke authority before removing listeners: callbacks already in flight are harmless.
            owner.invalidated = true;
            owner.desired = false;
            owner.clearCurrent = false;
            removeListeners = initialized;
            initialized = false;
            KCKeepAwakeCoordinator.unregister(this);
        }
        if (removeListeners) {
            reactContext.removeLifecycleEventListener(this);
            reactContext.removeActivityEventListener(this);
        }
        KCKeepAwakeCoordinator.dispatch();
    }

    @Override public void onHostResume() { reconcile(); }
    @Override public void onHostPause() { reconcile(); }
    @Override public void onHostDestroy() { reconcile(); }
    @Override public void onNewIntent(Intent intent) { reconcile(); }

    private void reconcile() {
        KCKeepAwakeCoordinator.changed(this);
    }
}
