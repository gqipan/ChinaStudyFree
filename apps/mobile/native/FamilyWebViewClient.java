package com.chinastudyfree.offline;

import android.net.Uri;
import android.os.Build;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.util.Map;

/** Retains Capacitor's bridge injection while serving the requested exported page. */
public final class FamilyWebViewClient extends BridgeWebViewClient {
    private final Bridge bridge;

    public FamilyWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String asset = StaticRoutePaths.assetPath(request.getUrl().toString(), bridge.getLocalUrl(),
            request.isForMainFrame(), request.getMethod());
        if (asset == null) return super.shouldInterceptRequest(view, request);
        Uri assetUrl = request.getUrl().buildUpon().path(asset).build();
        return super.shouldInterceptRequest(view, new WebResourceRequest() {
            @Override public Uri getUrl() { return assetUrl; }
            @Override public boolean isForMainFrame() { return request.isForMainFrame(); }
            @Override public boolean isRedirect() { return Build.VERSION.SDK_INT >= 24 && request.isRedirect(); }
            @Override public boolean hasGesture() { return request.hasGesture(); }
            @Override public String getMethod() { return request.getMethod(); }
            @Override public Map<String, String> getRequestHeaders() { return request.getRequestHeaders(); }
        });
    }
}
