package com.sayem.keepawake;

import static android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

import android.app.Activity;
import android.os.Looper;
import android.view.Window;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.common.LifecycleState;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;
import org.robolectric.shadow.api.Shadow;
import org.robolectric.shadows.ShadowLooper;

/** Real Android Window and, where specified, real RN lifecycle/listener implementation. */
@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 34)
@LooperMode(LooperMode.Mode.PAUSED)
public class KCKeepAwakeRegressionTest {
    private static void drain() {
        ((ShadowLooper) Shadow.extract(Looper.getMainLooper())).idle();
    }

    private static ReactApplicationContext context(Activity activity) {
        ReactApplicationContext context = mock(ReactApplicationContext.class);
        when(context.getCurrentActivity()).thenReturn(activity);
        when(context.getLifecycleState()).thenReturn(LifecycleState.RESUMED);
        return context;
    }

    private static int flag(Activity activity) {
        return activity.getWindow().getAttributes().flags & FLAG_KEEP_SCREEN_ON;
    }

    @Test public void imperativeDeactivateMustClearCurrentPreexistingFlag() {
        Activity activity = Robolectric.buildActivity(Activity.class).setup().get();
        KCKeepAwake module = new KCKeepAwake(context(activity));
        module.initialize();
        try {
            activity.getWindow().addFlags(FLAG_KEEP_SCREEN_ON);
            module.deactivate(); drain();
            assertEquals("Legacy deactivation clears the current Window without prior acquisition",
                    0, flag(activity));
        } finally {
            module.invalidate();
            activity.getWindow().clearFlags(FLAG_KEEP_SCREEN_ON);
        }
    }

    @Test public void realReactContextLifecycleAndNewIntent() {
        // Construct real RN listener collections; unmocked methods execute RN code.
        ReactApplicationContext context = mock(ReactApplicationContext.class, withSettings()
                .useConstructor(RuntimeEnvironment.getApplication()).defaultAnswer(CALLS_REAL_METHODS));
        KCKeepAwake module = new KCKeepAwake(context);
        module.initialize();
        Activity first = Robolectric.buildActivity(Activity.class).setup().get();
        Activity second = Robolectric.buildActivity(Activity.class).setup().get();
        try {
            module.activate(); drain(); assertEquals(0, flag(first));
            context.onHostResume(first); drain(); assertEquals(FLAG_KEEP_SCREEN_ON, flag(first));
            context.onHostPause(); drain(); assertEquals(FLAG_KEEP_SCREEN_ON, flag(first));
            context.onNewIntent(second, new android.content.Intent()); drain();
            assertEquals(0, flag(first)); assertEquals(FLAG_KEEP_SCREEN_ON, flag(second));
            context.onHostDestroy(); drain(); assertEquals(0, flag(second));
            context.onHostResume(first); drain(); assertEquals(FLAG_KEEP_SCREEN_ON, flag(first));
            module.invalidate(); drain(); assertEquals(0, flag(first));
            context.onHostResume(second); drain(); assertEquals(0, flag(second));
        } finally { module.invalidate(); }
    }

    @Test public void imperativeClearDoesNotRequireHostAcquisitionAuthority() {
        Activity activity = Robolectric.buildActivity(Activity.class).setup().get();
        ReactApplicationContext context = context(activity);
        when(context.getLifecycleState()).thenReturn(LifecycleState.BEFORE_CREATE);
        KCKeepAwake module = new KCKeepAwake(context);
        module.initialize();
        try {
            activity.getWindow().addFlags(FLAG_KEEP_SCREEN_ON);
            module.deactivate(); drain();
            assertEquals("A valid current Activity may be cleared even before host acquisition",
                    0, flag(activity));
            // Acquisition still requires lifecycle authority; clearing cannot loosen that fence.
            module.activate(); drain(); assertEquals(0, flag(activity));
        } finally {
            module.invalidate();
            activity.getWindow().clearFlags(FLAG_KEEP_SCREEN_ON);
        }
    }

    @Test public void realWindowCallbackReentrantInvalidation() {
        Activity activity = Robolectric.buildActivity(Activity.class).setup().get();
        ReactApplicationContext context = context(activity);
        KCKeepAwake module = new KCKeepAwake(context);
        module.initialize();
        Window.Callback callback = mock(Window.Callback.class);
        doAnswer(call -> { module.invalidate(); return null; })
                .when(callback).onWindowAttributesChanged(any());
        activity.getWindow().setCallback(callback);
        try {
            module.activate(); drain(); assertEquals(0, flag(activity));
            verify(context).removeLifecycleEventListener(any());
            verify(context).removeActivityEventListener(any());
            verify(callback, times(2)).onWindowAttributesChanged(any());
        } finally { module.invalidate(); }
    }

    @Test public void beforeCreateImperativeClearStillProtectsOtherRuntime() {
        Activity activity = Robolectric.buildActivity(Activity.class).setup().get();
        ReactApplicationContext clearerContext = context(activity);
        when(clearerContext.getLifecycleState()).thenReturn(LifecycleState.BEFORE_CREATE);
        KCKeepAwake clearer = new KCKeepAwake(clearerContext);
        KCKeepAwake requester = new KCKeepAwake(context(activity));
        clearer.initialize(); requester.initialize();
        try {
            requester.activate(); drain(); assertEquals(FLAG_KEEP_SCREEN_ON, flag(activity));
            clearer.deactivate(); drain(); assertEquals(FLAG_KEEP_SCREEN_ON, flag(activity));
            clearer.invalidate(); drain(); assertEquals(FLAG_KEEP_SCREEN_ON, flag(activity));
            requester.deactivate(); drain(); assertEquals(0, flag(activity));
        } finally { clearer.invalidate(); requester.invalidate(); drain(); }
    }
}
