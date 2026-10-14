// Adapted from
// https://github.com/gijoehosaphat/react-native-keep-screen-on

package com.sayem.keepawake;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class KCKeepAwake extends ReactContextBaseJavaModule {

    private final KCKeepAwakeImpl delegate;

    public KCKeepAwake(ReactApplicationContext reactContext) {
        super(reactContext);
        delegate = new KCKeepAwakeImpl(reactContext);
    }

    @Override
    public String getName() {
        return KCKeepAwakeImpl.NAME;
    }

    @Override
    public void initialize() {
        super.initialize();
        delegate.initialize();
    }

    @Override
    public void invalidate() {
        try {
            delegate.invalidate();
        } finally {
            super.invalidate();
        }
    }

    @ReactMethod
    public void activate() {
        delegate.activate();
    }

    @ReactMethod
    public void deactivate() {
        delegate.deactivate();
    }
}
