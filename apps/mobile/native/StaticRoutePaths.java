package com.chinastudyfree.offline;

import java.net.URI;

/** Maps same-origin document requests to Next's exported directory index. */
public final class StaticRoutePaths {
    private StaticRoutePaths() {}

    public static String assetPath(String requestUrl, String localUrl, boolean mainFrame, String method) {
        if (!mainFrame || !"GET".equals(method)) return null;
        try {
            URI request = new URI(requestUrl);
            URI local = new URI(localUrl);
            if (request.getHost() == null || local.getHost() == null ||
                !request.getHost().equalsIgnoreCase(local.getHost()) ||
                request.getScheme() == null || !request.getScheme().equalsIgnoreCase(local.getScheme()) ||
                effectivePort(request) != effectivePort(local) || request.getUserInfo() != null) return null;
            String path = request.getPath();
            if (path == null || path.equals("/") || !path.startsWith("/") || path.startsWith("//") ||
                path.startsWith("/api/") || path.indexOf('\\') >= 0 || path.indexOf('\0') >= 0) return null;
            for (String part : path.split("/")) if (part.equals(".") || part.equals("..")) return null;
            String directory = path.endsWith("/") ? path : path + "/";
            String last = directory.substring(0, directory.length() - 1);
            last = last.substring(last.lastIndexOf('/') + 1);
            if (last.contains(".")) return null;
            return directory + "index.html";
        } catch (Exception ignored) {
            return null;
        }
    }

    private static int effectivePort(URI uri) {
        return uri.getPort() >= 0 ? uri.getPort() : ("https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80);
    }
}
