package com.sayem.keepawake;

import static android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

import android.app.Activity;
import android.os.Looper;
import android.view.Window;
import com.facebook.react.bridge.ModuleHolder;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.common.LifecycleState;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;
import org.robolectric.shadow.api.Shadow;
import org.robolectric.shadows.ShadowLooper;

/** Run in an isolated test JVM: a confirmed cycle exits 86; an unclassified timeout exits 87. */
@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 34)
@LooperMode(LooperMode.Mode.PAUSED)
public class KCKeepAwakeDeadlockTest {
    @Test public void nativeModuleDestroyAndWindowCallbackLookupMustNotDeadlock() throws Exception {
        exerciseWindowCallback(false);
    }

    @Test public void nativeModuleDestroyAndClearCallbackLookupMustNotDeadlock() throws Exception {
        exerciseWindowCallback(true);
    }

    private static void drain() {
        ((ShadowLooper) Shadow.extract(Looper.getMainLooper())).idle();
    }

    private static void exerciseWindowCallback(boolean releasing) throws Exception {
        Activity activity = Robolectric.buildActivity(Activity.class).setup().get();
        ReactApplicationContext context = mock(ReactApplicationContext.class);
        when(context.getCurrentActivity()).thenReturn(activity);
        when(context.getLifecycleState()).thenReturn(LifecycleState.RESUMED);
        KCKeepAwake module = new KCKeepAwake(context);
        module.initialize();
        if (releasing) { module.activate(); drain(); }

        ModuleHolder holder = new ModuleHolder(module); // Actual RN teardown monitor.
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread destroyer = new Thread(() -> {
            try { holder.destroy(); } catch (Throwable error) { failure.set(error); }
        }, "keep-awake-RN-module-destroy");
        destroyer.setDaemon(true);
        Window.Callback callback = mock(Window.Callback.class);
        AtomicBoolean firstCallback = new AtomicBoolean(true);
        doAnswer(call -> {
            if (!firstCallback.getAndSet(false)) return null;
            destroyer.start();
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            // On the broken candidate destroy() owns the RN monitor and blocks on GATE.
            // On the correction it finishes without waiting for this synchronous callback.
            while (destroyer.isAlive() && destroyer.getState() != Thread.State.BLOCKED
                    && System.nanoTime() < deadline) Thread.yield();
            System.err.println("Destroy contender state before lookup: " + destroyer.getState());
            assertSame(module, holder.getModule()); // Real RN lookup inside the Android callback.
            return null;
        }).when(callback).onWindowAttributesChanged(any());
        activity.getWindow().setCallback(callback);

        AtomicBoolean completed = new AtomicBoolean();
        startWatchdog(completed);
        try {
            Thread requester = new Thread(() -> {
                try {
                    if (releasing) module.deactivate(); else module.activate();
                } catch (Throwable error) { failure.set(error); }
            }, "keep-awake-native-request");
            requester.start(); requester.join(5000);
            assertFalse("Native request must not wait for UI", requester.isAlive());
            drain();
            destroyer.join(5000);
            assertFalse("RN teardown must finish", destroyer.isAlive());
            assertNull(failure.get());
            assertFalse(firstCallback.get());
            assertEquals("Teardown must release the committed Window", 0,
                    activity.getWindow().getAttributes().flags & FLAG_KEEP_SCREEN_ON);
            verify(callback, times(releasing ? 1 : 2)).onWindowAttributesChanged(any());
        } finally {
            completed.set(true);
            module.invalidate();
            drain();
        }
    }

    private static void startWatchdog(AtomicBoolean completed) {
        Thread watchdog = new Thread(() -> {
            try {
                // Management APIs belong to the host JDK, not the Android compile SDK.
                Class<?> mx = Class.forName("java.lang.management.ThreadMXBean");
                Object bean = Class.forName("java.lang.management.ManagementFactory")
                        .getMethod("getThreadMXBean").invoke(null);
                Class<?> ti = Class.forName("java.lang.management.ThreadInfo");
                long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);
                while (System.nanoTime() < deadline) {
                    if (completed.get()) return;
                    long[] ids = (long[]) mx.getMethod("findDeadlockedThreads").invoke(bean);
                    if (ids != null) {
                        StringBuilder out = new StringBuilder("CONFIRMED JVM MONITOR DEADLOCK\n");
                        Object[] infos = (Object[]) mx.getMethod("getThreadInfo", long[].class,
                                boolean.class, boolean.class).invoke(bean, ids, true, true);
                        for (Object info : infos) {
                            out.append(ti.getMethod("getThreadName").invoke(info)).append(" waits ")
                                    .append(ti.getMethod("getLockInfo").invoke(info)).append(" owned by ")
                                    .append(ti.getMethod("getLockOwnerName").invoke(info)).append('\n');
                            for (StackTraceElement frame : (StackTraceElement[])
                                    ti.getMethod("getStackTrace").invoke(info)) out.append("  ").append(frame).append('\n');
                            for (Object monitor : (Object[])
                                    ti.getMethod("getLockedMonitors").invoke(info)) out.append("  owns ").append(monitor).append('\n');
                        }
                        System.err.println(out);
                        Runtime.getRuntime().halt(86);
                    }
                    Thread.sleep(10);
                }
            } catch (Exception error) {
                error.printStackTrace();
            }
            if (!completed.get()) {
                System.err.println("WATCHDOG: no confirmed monitor cycle");
                Runtime.getRuntime().halt(87);
            }
        }, "keep-awake-deadlock-watchdog");
        watchdog.setDaemon(true);
        watchdog.start();
    }
}
