import com.chinastudyfree.offline.StaticRoutePaths;
import java.nio.file.Files;
import java.nio.file.Path;

public class StaticRoutePathsTest {
    private static void check(String expected, String url, boolean document, String method) {
        String actual = StaticRoutePaths.assetPath(url, "https://localhost", document, method);
        if (!java.util.Objects.equals(expected, actual)) throw new AssertionError(url + ": expected " + expected + ", got " + actual);
    }
    public static void main(String[] args) throws Exception {
        check("/grade/1/index.html", "https://localhost/grade/1/", true, "GET");
        check("/book/g1up/index.html", "https://localhost/book/g1up", true, "GET");
        check("/profile/index.html", "https://localhost:443/profile/?from=nav", true, "GET");
        for (String url : new String[] {"https://localhost/", "https://localhost/_next/static/chunk.js", "https://localhost/data/index.json", "https://localhost/book/g1up/index.txt", "https://other.example.com/grade/1/", "http://localhost/grade/1/", "https://localhost:8443/grade/1/", "https://localhost/a/%2e%2e/b/", "https://localhost/a/%00/b/", "https://localhost/api/health", "invalid url"}) check(null, url, true, "GET");
        check(null, "https://localhost/grade/1/", false, "GET");
        check(null, "https://localhost/grade/1/", true, "POST");
        int count = 0;
        Path root = Path.of(args[0]).toRealPath();
        try (var files = Files.walk(root)) {
            for (Path file : files.filter(p -> p.toString().endsWith("/index.html")).toList()) {
                String relative = root.relativize(file).toString().replace('\\', '/');
                String route = "/" + relative.substring(0, relative.length() - "index.html".length());
                if (route.equals("/")) continue;
                check("/" + relative, "https://localhost" + route, true, "GET");
                count++;
            }
        }
        if (count < 4000) throw new AssertionError("Expected full exported course route coverage");
        System.out.println("Native static routing checks passed for " + count + " exported document routes");
    }
}
