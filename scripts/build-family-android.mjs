#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync, realpathSync, mkdtempSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function versionCode(value = String(Math.floor(Date.now() / 60000))) {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 2100000000) throw new Error('FAMILY_VERSION_CODE must be an integer from 1 to 2100000000.');
  return Number(value);
}
export function familyEnvironment(source, mode) {
  const env = { ...source, NEXT_PUBLIC_FAMILY_APP: '1', NEXT_PUBLIC_AI_BASE: '', FAMILY_ANDROID_MODE: mode };
  // Signing inputs are only consumed by Gradle, never Next or Capacitor.
  delete env.FAMILY_ANDROID_SIGNING_FILE;
  return env;
}
function externalFile(filename, label) {
  if (!filename || !path.isAbsolute(filename) || !existsSync(filename)) throw new Error(`${label} must name an existing absolute file outside the repository.`);
  const resolved = realpathSync(filename);
  if (resolved === root || resolved.startsWith(root + path.sep)) throw new Error(`${label} must be outside the repository.`);
  return resolved;
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, env: process.env, stdio: 'inherit', ...options });
  if (result.error || result.status !== 0) throw new Error(`${path.basename(command)} failed. Sensitive native/signing output is intentionally suppressed.`);
  return result.stdout;
}
function main() {
  const mode = process.argv[2] || 'debug';
  if (!['debug', 'release'].includes(mode) || process.argv.length > 3) throw new Error('Usage: node scripts/build-family-android.mjs [debug|release]');
  const code = versionCode(process.env.FAMILY_VERSION_CODE);
  let signingFile;
  if (mode === 'release') {
    signingFile = externalFile(process.env.FAMILY_ANDROID_SIGNING_FILE, 'FAMILY_ANDROID_SIGNING_FILE');
    let config;
    try { config = JSON.parse(readFileSync(signingFile, 'utf8')); } catch { throw new Error('Invalid external signing JSON.'); }
    externalFile(config.storeFile, 'Signing storeFile');
    if (!['storePassword', 'keyAlias', 'keyPassword'].every(key => typeof config[key] === 'string' && config[key].length)) throw new Error('External signing JSON is missing required fields.');
  }
  // Next loads local dotenv files automatically. Refuse them rather than accidentally bundling private values.
  for (const directory of [root, path.join(root, 'apps/web')]) {
    if (readdirSync(directory).some(name => /^\.env(?:\.(?:local|production|production\.local))?$/.test(name))) throw new Error('Move local .env files outside the repository before building the generic family APK.');
  }
  const env = familyEnvironment(process.env, mode);
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(root, 'tools/android-sdk');
  env.ANDROID_HOME = sdk;
  env.ANDROID_SDK_ROOT = sdk;
  env.GRADLE_USER_HOME = process.env.GRADLE_USER_HOME || path.join(root, 'tools/gradle-home');
  if (!env.JAVA_HOME && existsSync('/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home')) env.JAVA_HOME = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
  run('npm', ['run', 'build:web'], { env });
  if (!existsSync(path.join(sdk, 'platforms/android-34/android.jar'))) throw new Error('Android SDK platform 34 is required; see docs/family-android.md.');

  const mobile = path.join(root, 'apps/mobile');
  const android = path.join(mobile, 'android');
  // android/ is an ignored, disposable generated project. Recreate it on every build.
  rmSync(android, { recursive: true, force: true });
  const cap = path.join(root, 'node_modules/@capacitor/cli/bin/capacitor');
  run(process.execPath, [cap, 'add', 'android'], { cwd: mobile, env });
  run(process.execPath, [cap, 'sync', 'android'], { cwd: mobile, env });
  // Capacitor 6's original Gradle 8.2 wrapper cannot run on JDK 21.
  const wrapper = path.join(android, 'gradle/wrapper/gradle-wrapper.properties');
  writeFileSync(wrapper, readFileSync(wrapper, 'utf8').replace(/gradle-8\.2\.1-all\.zip/, 'gradle-8.7-bin.zip') + '\ndistributionSha256Sum=544c35d6bd849ae8a5ed0bcea39ba677dc40f49df7d1835561582da2009b961d\n');
  const appId = `com.chinastudyfree.family${mode === 'debug' ? '.debug' : ''}`;
  const activity = path.join(android, 'app/src/main/java', ...appId.split('.'), 'MainActivity.java');
  writeFileSync(activity, `package ${appId};
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
      @Override public void handleOnBackPressed() {
        if (getBridge() != null && getBridge().getWebView().canGoBack()) {
          getBridge().getWebView().goBack();
        } else { finish(); }
      }
    });
  }
}
`);
  const manifest = path.join(android, 'app/src/main/AndroidManifest.xml');
  writeFileSync(manifest, readFileSync(manifest, 'utf8')
    .replace('android:allowBackup="true"', 'android:allowBackup="false"')
    .replace(/@mipmap\/ic_launcher(?:_round)?/g, '@drawable/family_launcher')
    .replace('<application', '<application android:usesCleartextTraffic="false" android:fullBackupContent="false" android:dataExtractionRules="@xml/family_data_extraction_rules"'));
  copyFileSync(path.join(mobile, 'resources/family_launcher.xml'), path.join(android, 'app/src/main/res/drawable/family_launcher.xml'));
  // Keep learning records and the configured origin out of automatic OS backup/transfer.
  const excludes = ['root', 'file', 'database', 'sharedpref', 'external']
    .map(domain => `    <exclude domain="${domain}" path="." />`).join('\n');
  writeFileSync(path.join(android, 'app/src/main/res/xml/family_data_extraction_rules.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules>\n  <cloud-backup>\n${excludes}\n  </cloud-backup>\n  <device-transfer>\n${excludes}\n  </device-transfer>\n</data-extraction-rules>\n`);
  const appGradle = path.join(android, 'app/build.gradle');
  const gradle = readFileSync(appGradle, 'utf8').replace(/versionCode\s+\d+/, `versionCode ${code}`);
  writeFileSync(appGradle, gradle + `\n// Generated family settings: signing material is read only from an external private file.\nandroid {\n  buildTypes {\n    release {\n      debuggable false\n    }\n  }\n}\ndef familySigningPath = System.getenv('FAMILY_ANDROID_SIGNING_FILE')\nif (familySigningPath) {\n  def familySigning = new groovy.json.JsonSlurper().parse(new File(familySigningPath))\n  android.signingConfigs {\n    familyRelease {\n      storeFile file(familySigning.storeFile)\n      storePassword familySigning.storePassword\n      keyAlias familySigning.keyAlias\n      keyPassword familySigning.keyPassword\n    }\n  }\n  android.buildTypes.release.signingConfig = android.signingConfigs.familyRelease\n}\n`);
  const nativeEnv = { ...env, ...(signingFile ? { FAMILY_ANDROID_SIGNING_FILE: signingFile } : {}) };
  console.log(`Building family Android ${mode} (versionCode ${code})…`);
  run(path.join(android, 'gradlew'), ['--no-daemon', '--console=plain', '--quiet', mode === 'release' ? 'assembleRelease' : 'assembleDebug'], { cwd: android, env: nativeEnv, stdio: 'pipe' });
  const apk = path.join(android, `app/build/outputs/apk/${mode}/app-${mode}.apk`);
  const tools = path.join(sdk, 'build-tools/34.0.0');
  run(path.join(tools, 'apksigner'), ['verify', apk], { env, stdio: 'pipe' });
  const metadata = run(path.join(tools, 'aapt'), ['dump', 'badging', apk], { env, stdio: 'pipe', encoding: 'utf8' });
  if (!metadata.includes(`package: name='${appId}'`) || !metadata.includes(`versionCode='${code}'`)) throw new Error('APK identity/version verification failed.');
  const manifestDump = run(path.join(tools, 'aapt'), ['dump', 'xmltree', apk, 'AndroidManifest.xml'], { env, stdio: 'pipe', encoding: 'utf8' });
  if (!/usesCleartextTraffic[^\n]*=\(type 0x12\)0x0/.test(manifestDump)) throw new Error('APK cleartext policy verification failed.');
  if (!/allowBackup[^\n]*=\(type 0x12\)0x0/.test(manifestDump) || !/fullBackupContent[^\n]*=\(type 0x12\)0x0/.test(manifestDump) || !manifestDump.includes('dataExtractionRules')) throw new Error('APK backup privacy verification failed.');
  mkdirSync(path.join(root, 'release'), { recursive: true });
  const output = path.join(root, `release/family-${mode}-${code}.apk`);
  copyFileSync(apk, output);
  const sha = createHash('sha256').update(readFileSync(output)).digest('hex');
  writeFileSync(output + '.sha256', `${sha}  ${path.basename(output)}\n`);
  console.log(`Verified ${appId}, versionCode ${code}, cleartext disabled and APK signature.\n${output}\nSHA-256: ${sha}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--test') {
    const { default: assert } = await import('node:assert/strict');
    for (const input of ['0', '-1', '1.5', '01', '2100000001', '1;echo secret']) assert.throws(() => versionCode(input));
    assert.equal(versionCode('2100000000'), 2100000000);
    const env = familyEnvironment({ NEXT_PUBLIC_AI_BASE: 'https://private.invalid', FAMILY_ANDROID_SIGNING_FILE: '/private/key.json' }, 'release');
    assert.equal(env.NEXT_PUBLIC_AI_BASE, '');
    assert.equal(env.NEXT_PUBLIC_FAMILY_APP, '1');
    assert.equal(env.FAMILY_ANDROID_SIGNING_FILE, undefined);
    const temporary = mkdtempSync(path.join(tmpdir(), 'family-build-safety-'));
    try {
      const secret = path.join(temporary, 'signing.json');
      writeFileSync(secret, '{}');
      assert.equal(externalFile(secret, 'test'), realpathSync(secret));
      const link = path.join(temporary, 'repository-link.json');
      symlinkSync(path.join(root, 'package.json'), link);
      assert.throws(() => externalFile(link, 'test'));
      assert.throws(() => externalFile(path.join(root, 'package.json'), 'test'));
      assert.throws(() => externalFile('relative.json', 'test'));
    } finally { rmSync(temporary, { recursive: true, force: true }); }
    console.log('Family build safety checks passed.');
  } else {
    try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
