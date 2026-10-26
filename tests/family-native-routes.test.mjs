import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('native document routing preserves exported pages instead of serving the homepage', () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'family-native-routes-'));
  const javaHome = process.env.JAVA_HOME || '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
  try {
    execFileSync(path.join(javaHome, 'bin/javac'), ['-d', temporary,
      'apps/mobile/native/StaticRoutePaths.java', 'tests/native/StaticRoutePathsTest.java'], { stdio: 'pipe' });
    const output = execFileSync(path.join(javaHome, 'bin/java'), ['-cp', temporary, 'StaticRoutePathsTest', 'apps/web/out'], { encoding: 'utf8' });
    process.stdout.write(output);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
