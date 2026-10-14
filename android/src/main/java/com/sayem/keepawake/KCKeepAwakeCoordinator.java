package com.sayem.keepawake;

import static android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.view.Window;
import android.view.WindowManager;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.common.LifecycleState;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.Map;
import java.util.WeakHashMap;

/** Process-wide arbitration for this library only; never retains a runtime or Activity. */
final class KCKeepAwakeCoordinator {
    static final Object GATE = new Object();

    static final class Owner {
        final WeakReference<ReactApplicationContext> context;
        boolean desired;
        boolean invalidated;
        boolean clearCurrent;
        WeakReference<Window> appliedWindow = new WeakReference<>(null);

        Owner(ReactApplicationContext context) {
            this.context = new WeakReference<>(context);
        }
    }

    // Values do not refer back to their weak keys. Applied windows contain no owners or contexts.
    private static final Map<KCKeepAwakeImpl, Owner> OWNERS = new WeakHashMap<>();
    private static final Map<Window, Boolean> APPLIED = new WeakHashMap<>();
    private static final Handler UI = new Handler(Looper.getMainLooper());
    private static long revision;
    private static boolean posted;
    private static boolean reconciling;
    private static final Runnable RECONCILE = () -> {
        synchronized (GATE) {
            posted = false;
        }
        reconcileOnUiThread();
    };

    private KCKeepAwakeCoordinator() {}

    /** Caller holds GATE; scheduling and all RN APIs remain outside it. */
    static void register(KCKeepAwakeImpl impl) {
        OWNERS.put(impl, impl.owner);
        revision++;
    }

    static void unregister(KCKeepAwakeImpl impl) {
        OWNERS.remove(impl);
        impl.owner.appliedWindow.clear();
        revision++;
    }

    static void setDesired(KCKeepAwakeImpl impl, boolean desired) {
        synchronized (GATE) {
            if (impl.owner.invalidated) return;
            impl.owner.desired = desired;
            impl.owner.clearCurrent = !desired;
            OWNERS.put(impl, impl.owner);
            revision++;
        }
        dispatch();
    }

    static void changed(KCKeepAwakeImpl impl) {
        synchronized (GATE) {
            if (impl.owner.invalidated) return;
            revision++;
        }
        dispatch();
    }

    /** Never called with GATE held. Queued work carries no host or state snapshot. */
    static void dispatch() {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            reconcileOnUiThread();
        } else {
            synchronized (GATE) {
                if (posted) return;
                posted = true;
            }
            // Handler.post never invokes the runnable inline. A late post is harmless: it
            // reconciles current authority, and also covers changes after an inline UI pass.
            UI.post(RECONCILE);
        }
    }

    private static final class Request {
        final Owner owner;
        final boolean desired;
        final boolean clearCurrent;

        Request(Owner owner) {
            this.owner = owner;
            desired = owner.desired && !owner.invalidated;
            clearCurrent = owner.clearCurrent && !owner.invalidated;
        }
    }

    /** UI serializes Window effects. GATE fences only snapshots and callback-free commits. */
    private static void reconcileOnUiThread() {
        if (reconciling) return;
        reconciling = true;
        try {
            while (true) {
                long observed;
                ArrayList<Request> snapshot = new ArrayList<>();
                ArrayList<Window> releases;
                synchronized (GATE) {
                    observed = revision;
                    for (Owner owner : OWNERS.values()) snapshot.add(new Request(owner));
                    releases = new ArrayList<>(APPLIED.keySet());
                }
                Map<Window, Boolean> requested = new IdentityHashMap<>();
                Map<Owner, Window> targets = new IdentityHashMap<>();
                for (Request request : snapshot) {
                    Window window = request.desired || request.clearCurrent
                            ? currentWindow(request.owner, request.desired) : null;
                    targets.put(request.owner, request.desired ? window : null);
                    if (window != null) {
                        if (request.desired) requested.put(window, Boolean.TRUE);
                        else releases.add(window);
                    }
                }

                // Compute the whole union first, including owners whose UI work is still pending.
                for (Window window : releases) {
                    if (!requested.containsKey(window) && !writeFlag(window, false, observed)) break;
                }
                for (Window window : requested.keySet()) {
                    if (!writeFlag(window, true, observed)) break;
                }
                synchronized (GATE) {
                    if (observed != revision) continue;
                    for (Map.Entry<Owner, Window> target : targets.entrySet()) {
                        target.getKey().appliedWindow = new WeakReference<>(target.getValue());
                        target.getKey().clearCurrent = false;
                    }
                    return;
                }
            }
        } finally {
            reconciling = false;
        }
    }

    private static Window currentWindow(Owner owner, boolean acquiring) {
        ReactApplicationContext context = owner.context.get();
        // onHostDestroy may retain the Activity; its mere presence is not host authority.
        // Only acquisition needs that authority. An explicit legacy clear may release a
        // valid current Window even before resume; the requested union still protects it.
        if (context == null || (acquiring
                && context.getLifecycleState() == LifecycleState.BEFORE_CREATE)) return null;
        Activity activity = context.getCurrentActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) return null;
        return activity.getWindow();
    }

    private static boolean writeFlag(Window window, boolean awake, long observed) {
        // getAttributes() returns Window's live LayoutParams, not a copy. Read hosts and
        // Android objects outside GATE; any reentrant or concurrent change fences this pass.
        WindowManager.LayoutParams attributes = window.getAttributes();
        synchronized (GATE) {
            if (observed != revision) return false;
            if (awake) APPLIED.put(window, Boolean.TRUE);
            else APPLIED.remove(window);
            boolean applied = (attributes.flags & FLAG_KEEP_SCREEN_ON) != 0;
            if (applied == awake) return true;
            // Linearization point: the actual live flag changes while authority is fenced.
            // Invalidation either precedes this mutation (and cancels it) or follows it.
            attributes.flags = awake ? attributes.flags | FLAG_KEEP_SCREEN_ON
                    : attributes.flags & ~FLAG_KEEP_SCREEN_ON;
        }
        // Finish Android's normal setFlags bookkeeping and notification without GATE.
        // Library writes are serialized by this UI drain, so these calls repeat the committed bit; they
        // cannot introduce a new stale transition. Callbacks may revoke/change authority
        // without waiting for the drain; the next pass settles their current union.
        if (awake) window.addFlags(FLAG_KEEP_SCREEN_ON);
        else window.clearFlags(FLAG_KEEP_SCREEN_ON);
        return true;
    }
}
