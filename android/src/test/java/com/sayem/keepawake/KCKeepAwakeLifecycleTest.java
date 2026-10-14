package com.sayem.keepawake;

import static android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
import static org.junit.Assert.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import android.app.Activity;
import android.content.Intent;
import android.os.Looper;
import android.view.Window;
import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.common.LifecycleState;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;
import org.robolectric.shadow.api.Shadow;
import org.robolectric.shadows.ShadowLooper;

/** Exercises the selected production wrapper and delegate; only the RN host is simulated. */
@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 34)
@LooperMode(LooperMode.Mode.PAUSED)
public class KCKeepAwakeLifecycleTest {
    public static class TestActivity extends Activity {}

    private final List<Host> hosts = new ArrayList<>();
    private final List<ActivityController<TestActivity>> activities = new ArrayList<>();

    private static final class Screen {
        final Activity activity;
        final Window window;

        Screen(Activity activity, Window window) {
            this.activity = activity;
            this.window = window;
        }

        boolean awake() {
            return (window.getAttributes().flags & FLAG_KEEP_SCREEN_ON) != 0;
        }

        void writes(int adds, int clears) {
            verify(window, times(adds)).addFlags(FLAG_KEEP_SCREEN_ON);
            verify(window, times(clears)).clearFlags(FLAG_KEEP_SCREEN_ON);
        }
    }

    /** Mirrors RN ordering: publish resume/state before listeners; clear Activity after destroy. */
    private static final class Host {
        final ReactApplicationContext context = mock(ReactApplicationContext.class);
        final List<LifecycleEventListener> lifecycle = new ArrayList<>();
        final List<ActivityEventListener> activityEvents = new ArrayList<>();
        final KCKeepAwake module;
        Activity current;
        LifecycleState state = LifecycleState.BEFORE_CREATE;

        Host(boolean initialize) {
            when(context.getCurrentActivity()).thenAnswer(call -> current);
            when(context.getLifecycleState()).thenAnswer(call -> state);
            doAnswer(call -> { lifecycle.add(call.getArgument(0)); return null; })
                    .when(context).addLifecycleEventListener(any());
            doAnswer(call -> { lifecycle.remove(call.getArgument(0)); return null; })
                    .when(context).removeLifecycleEventListener(any());
            doAnswer(call -> { activityEvents.add(call.getArgument(0)); return null; })
                    .when(context).addActivityEventListener(any());
            doAnswer(call -> { activityEvents.remove(call.getArgument(0)); return null; })
                    .when(context).removeActivityEventListener(any());
            module = new KCKeepAwake(context);
            if (initialize) module.initialize();
        }

        void resume(Screen screen) {
            current = screen.activity;
            state = LifecycleState.RESUMED;
            for (LifecycleEventListener listener : new ArrayList<>(lifecycle)) listener.onHostResume();
        }

        void destroy(boolean keepActivity) {
            state = LifecycleState.BEFORE_CREATE;
            for (LifecycleEventListener listener : new ArrayList<>(lifecycle)) listener.onHostDestroy();
            if (!keepActivity) current = null;
        }

        void newIntent(Screen screen) {
            current = screen.activity;
            for (ActivityEventListener listener : new ArrayList<>(activityEvents))
                listener.onNewIntent(new Intent());
        }
    }

    private Host host() {
        return host(true);
    }

    private Host host(boolean initialize) {
        Host host = new Host(initialize);
        hosts.add(host);
        drain();
        return host;
    }

    private Screen screen() {
        ActivityController<TestActivity> controller = Robolectric.buildActivity(TestActivity.class).setup();
        activities.add(controller);
        Activity activity = spy(controller.get());
        Window window = spy(activity.getWindow());
        doReturn(window).when(activity).getWindow();
        clearInvocations(window);
        return new Screen(activity, window);
    }

    private static void drain() {
        ShadowLooper mainLooper = Shadow.extract(Looper.getMainLooper());
        mainLooper.idle();
    }

    private static void worker(Runnable action) throws Exception {
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread thread = new Thread(() -> {
            try { action.run(); } catch (Throwable error) { failure.set(error); }
        }, "keep-awake-test-worker");
        thread.start();
        thread.join(5000);
        assertFalse("Worker must not wait for the UI thread", thread.isAlive());
        if (failure.get() != null) throw new AssertionError("Worker failed", failure.get());
    }

    @After public void cleanup() {
        for (Host host : hosts) host.module.invalidate();
        drain();
        for (ActivityController<TestActivity> activity : activities) activity.pause().stop().destroy();
        drain();
    }

    @Test public void activateWithoutActivityReconcilesOnResume() throws Exception {
        Host host = host();
        worker(host.module::activate);
        drain();
        Screen screen = screen();
        host.resume(screen);
        drain();
        assertTrue("Desired activation must survive a null Activity", screen.awake());
        screen.writes(1, 0);
    }

    @Test public void deactivateWithNullActivityClearsPreviouslyOwnedWindow() throws Exception {
        Host host = host();
        Screen screen = screen();
        host.resume(screen);
        worker(host.module::activate);
        drain();
        assertTrue(screen.awake());
        host.current = null;
        worker(host.module::deactivate);
        drain();
        assertFalse("Release must use owned state even when current Activity is null", screen.awake());
        screen.writes(1, 1);
    }

    @Test public void queuedActivationUsesCurrentActivity() throws Exception {
        Host host = host();
        Screen old = screen();
        Screen current = screen();
        host.resume(old);
        worker(host.module::activate);
        host.resume(current);
        drain();
        assertFalse("Queued work must not activate the captured old Activity", old.awake());
        assertTrue(current.awake());
        old.writes(0, 0);
        current.writes(1, 0);
    }

    @Test public void recreationKeepsDesiredStateAndReleasesOldWindow() throws Exception {
        Host host = host();
        Screen old = screen();
        host.resume(old);
        worker(host.module::activate);
        drain();
        host.destroy(false);
        drain();
        assertFalse(old.awake());
        Screen recreated = screen();
        host.resume(recreated);
        drain();
        assertTrue(recreated.awake());
        old.writes(1, 1);
        recreated.writes(1, 0);
    }

    @Test public void hostDestroyReleasesEvenWhenContextKeepsActivity() throws Exception {
        Host host = host();
        Screen screen = screen();
        host.resume(screen);
        worker(host.module::activate);
        drain();
        host.destroy(true);
        drain();
        worker(host.module::activate);
        drain();
        assertFalse("BEFORE_CREATE cannot reacquire a retained Activity", screen.awake());
        screen.writes(1, 1);
    }

    @Test public void destroyWithQueuedActivationDoesNotReactivate() throws Exception {
        Host host = host();
        Screen screen = screen();
        host.resume(screen);
        worker(host.module::activate);
        host.destroy(true);
        drain();
        assertFalse(screen.awake());
        screen.writes(0, 0);
    }

    @Test public void invalidateReleasesActiveFlagAndListeners() throws Exception {
        Host host = host();
        Screen screen = screen();
        host.resume(screen);
        worker(host.module::activate);
        drain();
        worker(host.module::invalidate);
        drain();
        assertFalse(screen.awake());
        assertTrue(host.lifecycle.isEmpty());
        assertTrue(host.activityEvents.isEmpty());
        screen.writes(1, 1);
    }

    @Test public void invalidatePreventsQueuedActivationAndLateCalls() throws Exception {
        Host host = host();
        Screen screen = screen();
        host.resume(screen);
        worker(host.module::activate);
        worker(host.module::invalidate);
        worker(host.module::activate);
        worker(host.module::deactivate);
        host.module.initialize();
        host.module.invalidate();
        drain();
        assertFalse(screen.awake());
        assertTrue(host.lifecycle.isEmpty());
        assertTrue(host.activityEvents.isEmpty());
        screen.writes(0, 0);
    }

    @Test public void lateCallbacksAfterInvalidateAreHarmless() throws Exception {
        Host host = host();
        Screen old = screen();
        Screen current = screen();
        host.resume(old);
        worker(host.module::activate);
        drain();
        List<LifecycleEventListener> late = new ArrayList<>(host.lifecycle);
        List<ActivityEventListener> lateIntents = new ArrayList<>(host.activityEvents);
        host.module.invalidate();
        host.current = current.activity;
        for (LifecycleEventListener listener : late) {
            listener.onHostResume(); listener.onHostPause(); listener.onHostDestroy();
        }
        for (ActivityEventListener listener : lateIntents) listener.onNewIntent(new Intent());
        drain();
        assertFalse(old.awake());
        assertFalse(current.awake());
        old.writes(1, 1);
        current.writes(0, 0);
    }

    @Test public void twoRuntimesSharingWindowSurviveOneInvalidation() throws Exception {
        Host first = host(); Host second = host(); Screen screen = screen();
        first.resume(screen); second.resume(screen);
        worker(first.module::activate); worker(second.module::activate); drain();
        assertTrue(screen.awake());
        first.module.invalidate(); drain();
        assertTrue("Other runtime still owns this Window", screen.awake());
        second.module.invalidate(); drain();
        assertFalse(screen.awake());
        screen.writes(1, 1);
    }

    @Test public void twoRuntimesSharingWindowSurviveOneDeactivation() throws Exception {
        Host first = host(); Host second = host(); Screen screen = screen();
        first.resume(screen); second.resume(screen);
        worker(first.module::activate); worker(second.module::activate); drain();
        worker(first.module::deactivate); drain();
        assertTrue(screen.awake());
        worker(second.module::deactivate); drain();
        assertFalse(screen.awake());
        screen.writes(1, 1);
    }

    @Test public void twoRuntimesOnDifferentWindowsAreIndependent() throws Exception {
        Host first = host(); Host second = host(); Screen a = screen(); Screen b = screen();
        first.resume(a); second.resume(b);
        worker(first.module::activate); worker(second.module::activate); drain();
        first.module.invalidate(); drain();
        assertFalse(a.awake()); assertTrue(b.awake());
        a.writes(1, 1); b.writes(1, 0);
    }

    @Test public void pendingOtherRuntimeProtectsWindowDuringInlineDeactivation() throws Exception {
        Host first = host(); Host second = host(); Screen screen = screen();
        first.resume(screen); second.resume(screen);
        worker(first.module::activate); drain();
        worker(second.module::activate);
        first.module.deactivate();
        assertTrue("Already recorded pending ownership must prevent a transient clear", screen.awake());
        drain();
        screen.writes(1, 0);
    }

    @Test public void pendingOtherRuntimeProtectsWindowDuringInlineInvalidation() throws Exception {
        Host first = host(); Host second = host(); Screen screen = screen();
        first.resume(screen); second.resume(screen);
        worker(first.module::activate); drain();
        worker(second.module::activate);
        first.module.invalidate();
        assertTrue(screen.awake());
        drain();
        screen.writes(1, 0);
    }

    @Test public void rapidActivateDeactivateBeforeDrainNeverWritesFlag() throws Exception {
        Host host = host(); Screen screen = screen(); host.resume(screen);
        worker(() -> { host.module.activate(); host.module.deactivate(); });
        drain();
        assertFalse(screen.awake());
        screen.writes(0, 0);
    }

    @Test public void activateDeactivateActivateCoalescesToSingleWrite() throws Exception {
        Host host = host(); Screen screen = screen(); host.resume(screen);
        worker(() -> { host.module.activate(); host.module.deactivate(); host.module.activate(); });
        drain();
        assertTrue(screen.awake());
        screen.writes(1, 0);
    }

    @Test public void repeatedCallsDoNotDuplicateNativeTransitions() throws Exception {
        Host host = host(); Screen screen = screen(); host.resume(screen);
        for (int i = 0; i < 3; i++) { worker(host.module::activate); drain(); }
        screen.writes(1, 0);
        for (int i = 0; i < 3; i++) { worker(host.module::deactivate); drain(); }
        screen.writes(1, 1);
        host.module.invalidate(); host.module.invalidate(); drain();
        screen.writes(1, 1);
    }

    @Test public void finishingAndDestroyedActivitiesCannotAcquire() throws Exception {
        Host host = host(); Screen screen = screen(); host.resume(screen);
        doReturn(true).when(screen.activity).isFinishing();
        worker(host.module::activate); drain();
        assertFalse(screen.awake());
        doReturn(false).when(screen.activity).isFinishing();
        doReturn(true).when(screen.activity).isDestroyed();
        host.resume(screen); drain();
        assertFalse(screen.awake());
        screen.writes(0, 0);
    }

    @Test public void newIntentRebindsCurrentWindow() throws Exception {
        Host host = host(); Screen old = screen(); Screen current = screen(); host.resume(old);
        worker(host.module::activate); drain();
        host.newIntent(current); drain();
        assertFalse(old.awake()); assertTrue(current.awake());
        old.writes(1, 1); current.writes(1, 0);
    }

    @Test public void pausePreservesDesiredAndAppliedState() throws Exception {
        Host host = host(); Screen screen = screen(); host.resume(screen);
        worker(host.module::activate); drain();
        host.state = LifecycleState.BEFORE_RESUME;
        for (LifecycleEventListener listener : new ArrayList<>(host.lifecycle)) listener.onHostPause();
        drain();
        assertTrue(screen.awake());
        host.resume(screen); drain();
        screen.writes(1, 0);
    }

    @Test public void crossedMigrationsComputeUnionBeforeReleasingWindows() throws Exception {
        Host first = host(); Host second = host(); Screen a = screen(); Screen b = screen();
        first.resume(a); second.resume(b);
        worker(first.module::activate); worker(second.module::activate); drain();
        first.current = b.activity; second.current = a.activity;
        for (LifecycleEventListener listener : new ArrayList<>(first.lifecycle)) listener.onHostResume();
        drain();
        assertTrue(a.awake()); assertTrue(b.awake());
        first.module.deactivate(); drain();
        assertTrue(a.awake()); assertFalse(b.awake());
        a.writes(1, 0); b.writes(1, 1);
    }

    @Test public void initializationRegistersListenersExactlyOnce() {
        Host host = host();
        host.module.initialize(); drain();
        assertEquals(1, host.lifecycle.size());
        assertEquals(1, host.activityEvents.size());
        host.module.invalidate(); drain();
        host.module.initialize(); drain();
        assertTrue(host.lifecycle.isEmpty()); assertTrue(host.activityEvents.isEmpty());
    }

    @Test public void activityAndLifecycleAreReadOnlyOnUiThread() throws Exception {
        Host host = host(); Screen screen = screen(); host.resume(screen);
        when(host.context.getCurrentActivity()).thenAnswer(call -> {
            assertSame(Looper.getMainLooper().getThread(), Thread.currentThread());
            return host.current;
        });
        when(host.context.getLifecycleState()).thenAnswer(call -> {
            assertSame(Looper.getMainLooper().getThread(), Thread.currentThread());
            return host.state;
        });
        worker(host.module::activate); drain();
        assertTrue(screen.awake());
        worker(host.module::invalidate); drain();
        assertFalse(screen.awake());
    }

    @Test public void initializationCannotLeaveListenerAfterReentrantInvalidation() {
        Host host = host(false);
        doAnswer(call -> {
            host.lifecycle.add(call.getArgument(0));
            host.module.invalidate();
            return null;
        }).when(host.context).addLifecycleEventListener(any());
        host.module.initialize();
        drain();
        assertTrue(host.lifecycle.isEmpty());
        assertTrue("Initialization must not continue registering after terminal invalidation",
                host.activityEvents.isEmpty());
        host.module.activate(); drain();
        assertTrue(host.activityEvents.isEmpty());
    }

    @Test public void reentrantInvalidationDuringWindowWriteReleasesExactlyOnce() throws Exception {
        Host host = host(); Screen screen = screen(); host.resume(screen);
        doAnswer(call -> {
            call.callRealMethod();
            host.module.invalidate();
            return null;
        }).when(screen.window).addFlags(FLAG_KEEP_SCREEN_ON);
        worker(host.module::activate); drain();
        assertFalse(screen.awake());
        assertTrue(host.lifecycle.isEmpty()); assertTrue(host.activityEvents.isEmpty());
        worker(host.module::activate); drain();
        screen.writes(1, 1);
    }

    @Test public void reentrantReleaseCancelsPreviouslyComputedOtherWindowTarget() throws Exception {
        Host first = host(); Host second = host(); Screen a = screen(); Screen b = screen();
        first.resume(a); second.resume(b);
        worker(first.module::activate); worker(second.module::activate); drain();
        doAnswer(call -> {
            call.callRealMethod();
            second.module.deactivate();
            return null;
        }).when(a.window).clearFlags(FLAG_KEEP_SCREEN_ON);
        first.module.deactivate(); drain();
        assertFalse(a.awake()); assertFalse(b.awake());
        a.writes(1, 1); b.writes(1, 1);
    }

    @Test public void concurrentInvalidationObservesCommitWithoutWaitingForNotification() throws Exception {
        Host host = host(); Screen screen = screen(); host.resume(screen);
        android.view.WindowManager.LayoutParams attributes = screen.window.getAttributes();
        AtomicBoolean returned = new AtomicBoolean();
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread invalidator = new Thread(() -> {
            try {
                host.module.invalidate();
                assertTrue("The actual live flag commit must precede invalidation's return",
                        (attributes.flags & FLAG_KEEP_SCREEN_ON) != 0);
                returned.set(true);
            }
            catch (Throwable error) { failure.set(error); }
        }, "keep-awake-concurrent-invalidator");
        doAnswer(call -> {
            assertTrue("The mutation must already be committed before external notification",
                    screen.awake());
            invalidator.start();
            invalidator.join(5000);
            assertFalse("Teardown must not wait for an external Window operation", invalidator.isAlive());
            assertNull(failure.get());
            assertTrue(returned.get());
            call.callRealMethod();
            return null;
        }).when(screen.window).addFlags(FLAG_KEEP_SCREEN_ON);
        worker(host.module::activate); drain();
        invalidator.join(5000);
        assertFalse(invalidator.isAlive()); assertNull(failure.get()); assertTrue(returned.get());
        drain();
        assertFalse(screen.awake());
        worker(host.module::activate); drain();
        screen.writes(1, 1);
    }

    @Test public void staleDestroyCallbackCannotClearResumedReplacement() throws Exception {
        Host host = host(); Screen old = screen(); Screen current = screen(); host.resume(old);
        worker(host.module::activate); drain();
        LifecycleEventListener oldListener = host.lifecycle.get(0);
        host.resume(current); drain();
        oldListener.onHostDestroy(); drain();
        assertFalse(old.awake()); assertTrue(current.awake());
        old.writes(1, 1); current.writes(1, 0);
    }

    @Test public void concurrentInvalidationBeforeMutationCancelsStaleTarget() throws Exception {
        Host host = host(); Screen screen = screen(); host.resume(screen);
        AtomicBoolean once = new AtomicBoolean(true);
        when(host.context.getCurrentActivity()).thenAnswer(call -> {
            if (once.getAndSet(false)) worker(host.module::invalidate);
            return host.current;
        });
        worker(host.module::activate); drain();
        assertFalse(screen.awake());
        assertTrue(host.lifecycle.isEmpty()); assertTrue(host.activityEvents.isEmpty());
        worker(host.module::activate); drain();
        screen.writes(0, 0);
    }

    @Test public void concurrentRequestDuringTargetReadPreventsStaleClear() throws Exception {
        Host first = host(); Host second = host(); Screen screen = screen();
        first.resume(screen); second.resume(screen);
        first.module.activate();
        AtomicBoolean once = new AtomicBoolean(true);
        when(first.context.getCurrentActivity()).thenAnswer(call -> {
            if (once.getAndSet(false)) worker(second.module::activate);
            return first.current;
        });
        first.module.deactivate(); drain();
        assertTrue("Ownership recorded during an external read must fence a stale release", screen.awake());
        screen.writes(1, 0);
    }

    @Test public void concurrentDeactivationDuringNotificationSettlesWithoutLateAcquire() throws Exception {
        Host host = host(); Screen screen = screen(); host.resume(screen);
        doAnswer(call -> {
            assertTrue(screen.awake());
            worker(host.module::deactivate);
            return call.callRealMethod();
        }).when(screen.window).addFlags(FLAG_KEEP_SCREEN_ON);
        worker(host.module::activate); drain();
        assertFalse(screen.awake());
        screen.writes(1, 1);
        drain(); screen.writes(1, 1);
    }

    @Test public void replacementDuringNotificationReleasesOldAndAcquiresCurrent() throws Exception {
        Host host = host(); Screen old = screen(); Screen current = screen(); host.resume(old);
        doAnswer(call -> {
            call.callRealMethod();
            host.resume(current);
            return null;
        }).when(old.window).addFlags(FLAG_KEEP_SCREEN_ON);
        worker(host.module::activate); drain();
        assertFalse(old.awake()); assertTrue(current.awake());
        old.writes(1, 1); current.writes(1, 0);
    }

    @Test public void inFlightLifecycleRegistrationRemovesListenerAddedAfterInvalidation() {
        Host host = host(false);
        doAnswer(call -> {
            worker(host.module::invalidate);
            host.lifecycle.add(call.getArgument(0));
            return null;
        }).when(host.context).addLifecycleEventListener(any());
        host.module.initialize(); drain();
        assertTrue(host.lifecycle.isEmpty()); assertTrue(host.activityEvents.isEmpty());
        host.module.initialize(); host.module.activate(); drain();
        assertTrue(host.lifecycle.isEmpty()); assertTrue(host.activityEvents.isEmpty());
    }

    @Test public void inFlightActivityRegistrationRemovesListenerAddedAfterInvalidation() {
        Host host = host(false);
        doAnswer(call -> {
            worker(host.module::invalidate);
            host.activityEvents.add(call.getArgument(0));
            return null;
        }).when(host.context).addActivityEventListener(any());
        host.module.initialize(); drain();
        assertTrue(host.lifecycle.isEmpty()); assertTrue(host.activityEvents.isEmpty());
        host.module.initialize(); host.module.activate(); drain();
        assertTrue(host.lifecycle.isEmpty()); assertTrue(host.activityEvents.isEmpty());
    }

    @Test public void externalHostAndWindowCallsNeverHoldCoordinatorGate() {
        Host host = host(false); Screen screen = screen();
        doAnswer(call -> {
            assertFalse(Thread.holdsLock(KCKeepAwakeCoordinator.GATE));
            host.lifecycle.add(call.getArgument(0)); return null;
        }).when(host.context).addLifecycleEventListener(any());
        doAnswer(call -> {
            assertFalse(Thread.holdsLock(KCKeepAwakeCoordinator.GATE));
            host.activityEvents.add(call.getArgument(0)); return null;
        }).when(host.context).addActivityEventListener(any());
        doAnswer(call -> {
            assertFalse(Thread.holdsLock(KCKeepAwakeCoordinator.GATE));
            host.lifecycle.remove(call.getArgument(0)); return null;
        }).when(host.context).removeLifecycleEventListener(any());
        doAnswer(call -> {
            assertFalse(Thread.holdsLock(KCKeepAwakeCoordinator.GATE));
            host.activityEvents.remove(call.getArgument(0)); return null;
        }).when(host.context).removeActivityEventListener(any());
        when(host.context.getCurrentActivity()).thenAnswer(call -> {
            assertFalse(Thread.holdsLock(KCKeepAwakeCoordinator.GATE)); return host.current;
        });
        when(host.context.getLifecycleState()).thenAnswer(call -> {
            assertFalse(Thread.holdsLock(KCKeepAwakeCoordinator.GATE)); return host.state;
        });
        doAnswer(call -> {
            assertFalse(Thread.holdsLock(KCKeepAwakeCoordinator.GATE)); return call.callRealMethod();
        }).when(screen.window).addFlags(FLAG_KEEP_SCREEN_ON);
        doAnswer(call -> {
            assertFalse(Thread.holdsLock(KCKeepAwakeCoordinator.GATE)); return call.callRealMethod();
        }).when(screen.window).clearFlags(FLAG_KEEP_SCREEN_ON);
        host.module.initialize(); host.resume(screen);
        host.module.activate(); host.module.deactivate(); host.module.invalidate(); drain();
        screen.writes(1, 1);
        assertTrue(host.lifecycle.isEmpty()); assertTrue(host.activityEvents.isEmpty());
    }

    @Test public void imperativeClearWithoutAcquisitionProtectsPendingOtherRuntime() throws Exception {
        Host clearer = host(); Host requester = host(); Screen screen = screen();
        clearer.resume(screen); requester.resume(screen);
        screen.window.addFlags(FLAG_KEEP_SCREEN_ON); clearInvocations(screen.window);
        worker(requester.module::activate);
        clearer.module.deactivate(); drain();
        assertTrue(screen.awake());
        screen.writes(0, 0);
        requester.module.deactivate(); drain();
        assertFalse(screen.awake()); screen.writes(0, 1);
    }

    @Test public void imperativeClearIsConsumedAndDoesNotBecomePermanentHostOwnership() {
        Host host = host(); Screen screen = screen(); host.resume(screen);
        screen.window.addFlags(FLAG_KEEP_SCREEN_ON);
        host.module.deactivate(); drain(); assertFalse(screen.awake());
        screen.window.addFlags(FLAG_KEEP_SCREEN_ON); clearInvocations(screen.window);
        host.resume(screen); drain(); assertTrue(screen.awake());
        host.module.invalidate(); drain(); assertTrue(screen.awake());
        screen.writes(0, 0);
        screen.window.clearFlags(FLAG_KEEP_SCREEN_ON);
    }
}
