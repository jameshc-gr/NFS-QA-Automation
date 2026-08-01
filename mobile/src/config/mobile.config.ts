import path from 'node:path';
import {
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  copyFileSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import YAML from 'yaml';

import { decryptObjectSecrets } from '../utils/crypto-utils';

type MobilePlatform = 'android' | 'ios';
type AndroidSource = 'local' | 'url' | 'firebase' | 'firebase-web';
type IOSMode = 'testflight' | 'real-device' | 'simulator';
type IOSSource = 'simulator' | 'ipa' | 'testflight' | 'xcode';
type XcodeTarget = 'simulator' | 'device';

interface IOSXcodeConfig {
  projectPath?: string;
  workspacePath?: string;
  scheme?: string;
  configuration?: string;
  target?: XcodeTarget;
  productName?: string;
  derivedDataPath?: string;
  /** `missing` reuses an existing artifact; `always` rebuilds from the working copy. */
  build?: 'missing' | 'always';
  exportMethod?: string;
  teamId?: string;
  /**
   * Simulator builds are signed like Xcode signs them, because skipping signing
   * also strips entitlements the app needs at runtime. Set this to false only
   * when no signing identity is available.
   */
  codeSigning?: boolean;
}

interface IOSBuild {
  source?: IOSSource;
  bundleId?: string;
  environment?: string;
  appPath?: string;
  ipaPath?: string;
  ipaUrl?: string;
  ipaAuthHeader?: string;
  deviceName?: string;
  deviceUdid?: string;
  xcode?: IOSXcodeConfig;
}

/** Where the app clones live. Folder names carry the release version. */
interface IOSRepoConfig {
  root?: string;
  folderPrefix?: string;
  projectName?: string;
  version?: string;
}

interface IOSBuildConfig {
  defaultBuild?: string;
  repo?: IOSRepoConfig;
  artifactRoot?: string;
  builds?: Record<string, IOSBuild>;
}

interface ResolvedIOSConfig {
  build: IOSBuild;
  repo: IOSRepoConfig;
  artifactRoot: string;
}

/** Which Firebase App Distribution release to pull for a build. */
interface AndroidFirebaseRef {
  appId?: string;
  /** `latest`, a versionName, a versionCode, "1.43-qa (1130)", or a release id. */
  release?: string;
  /** App Distribution page used by the Playwright downloader (no API access needed). */
  webUrl?: string;
}

interface AndroidBuild {
  source?: AndroidSource;
  environment?: string;
  appPackage?: string;
  appActivity?: string;
  appPath?: string;
  appUrl?: string;
  authHeader?: string;
  firebase?: AndroidFirebaseRef;
}

interface AndroidFirebaseConfig {
  /** Service account json with the Firebase App Distribution Admin role. */
  serviceAccountKeyFile?: string;
  /** A ready-made OAuth access token, e.g. from `gcloud auth print-access-token`. */
  accessToken?: string;
  /** Default App Distribution page for the Playwright downloader. */
  webUrl?: string;
}

interface AndroidBuildConfig {
  defaultBuild?: string;
  artifactRoot?: string;
  /** Needed only when a Firebase release is an .aab instead of an .apk. */
  bundletoolJar?: string;
  firebase?: AndroidFirebaseConfig;
  builds?: Record<string, AndroidBuild>;
}

interface ResolvedAndroidConfig {
  name: string;
  build: AndroidBuild;
  artifactRoot: string;
  bundletoolJar: string;
  firebase: AndroidFirebaseConfig;
}
/** What an apk says about itself, used to label the published artifact. */
interface ApkInfo {
  packageName: string;
  versionName: string;
  versionCode: string;
}

const IOS_CONFIG_PATH = 'test-data/mobile-app/gri/ios/config.yml';
const ANDROID_CONFIG_PATH = 'test-data/mobile-app/gri/android/config.yml';
const IPA_CACHE_DIR = 'mobile/.builds';
const DEFAULT_ARTIFACT_ROOT = 'test-data/mobile-app/gri/ios';
const DEFAULT_ANDROID_ARTIFACT_ROOT = 'test-data/mobile-app/gri/android';

export type MobileCapabilities = Record<string, unknown>;

function resolvePlatform(): MobilePlatform {
  const value = (process.env.MOBILE_PLATFORM || 'android').toLowerCase();
  return value === 'ios' ? 'ios' : 'android';
}

/**
 * Downloads a file with curl. The auth header is passed as an argv entry rather
 * than interpolated into a shell string, so tokens never reach a shell.
 */
function downloadFile(url: string, target: string, authHeader?: string): void {
  mkdirSync(path.dirname(target), { recursive: true });
  const args = ['--fail', '--location', '--silent', '--show-error', '--output', target, url];
  if (authHeader) {
    args.unshift('--header', authHeader);
  }

  execFileSync('curl', args, { stdio: ['ignore', 'ignore', 'inherit'] });
}

function curlJson(url: string, accessToken: string): unknown {
  const body = execFileSync(
    'curl',
    ['--fail', '--location', '--silent', '--show-error', '--header', `Authorization: Bearer ${accessToken}`, url],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] }
  );

  return JSON.parse(body);
}

/** Reads the named Android build (or the configured default) out of the config. */
export function resolveAndroidBuild(): ResolvedAndroidConfig {
  const empty: ResolvedAndroidConfig = {
    name: '',
    build: {},
    artifactRoot: DEFAULT_ANDROID_ARTIFACT_ROOT,
    bundletoolJar: '',
    firebase: {}
  };

  const configPath = path.resolve(process.cwd(), ANDROID_CONFIG_PATH);
  if (!existsSync(configPath)) {
    return empty;
  }

  const parsed = YAML.parse(readFileSync(configPath, 'utf8')) as { android?: AndroidBuildConfig } | undefined;
  const config = parsed?.android;
  if (!config?.builds) {
    return empty;
  }

  const name = process.env.MOBILE_ANDROID_BUILD || config.defaultBuild;
  if (!name) {
    return empty;
  }

  const build = config.builds[name];
  if (!build) {
    throw new Error(
      `Unknown Android build "${name}". Available builds in ${ANDROID_CONFIG_PATH}: ${Object.keys(config.builds).join(', ')}`
    );
  }

  console.log(`[mobile] using Android build "${name}" (source: ${build.source || 'local'})`);

  return {
    name,
    build: decryptObjectSecrets(build),
    artifactRoot: config.artifactRoot || DEFAULT_ANDROID_ARTIFACT_ROOT,
    bundletoolJar: process.env.MOBILE_BUNDLETOOL_JAR || config.bundletoolJar || '',
    firebase: decryptObjectSecrets(config.firebase || {})
  };
}

/** Finds aapt2, which is what reports the package and version of an apk. */
function resolveAapt2(): string {
  if (process.env.MOBILE_AAPT2) {
    return process.env.MOBILE_AAPT2;
  }

  const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || path.join(process.env.HOME || '', 'Library/Android/sdk');
  const buildTools = path.join(sdk, 'build-tools');

  if (existsSync(buildTools)) {
    const versions = readdirSync(buildTools)
      .filter((entry) => statSync(path.join(buildTools, entry)).isDirectory())
      .sort((a, b) => compareVersions(b, a));

    for (const version of versions) {
      const candidate = path.join(buildTools, version, 'aapt2');
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return 'aapt2';
}

function readApkInfo(apkPath: string): ApkInfo {
  try {
    const badging = execFileSync(resolveAapt2(), ['dump', 'badging', apkPath], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore']
    });

    const line = badging.split('\n').find((entry) => entry.startsWith('package:')) || '';
    const read = (key: string): string => new RegExp(`${key}='([^']*)'`).exec(line)?.[1] || '';

    return { packageName: read('name'), versionName: read('versionName'), versionCode: read('versionCode') };
  } catch {
    // Without aapt2 the artifact is still usable, it just cannot be labelled.
    return { packageName: '', versionName: '', versionCode: '' };
  }
}

/** `1.43-qa` publishes under `1.43`, so the version folder matches across environments. */
function androidVersionFolder(versionName: string): string {
  const match = /^([0-9]+(?:\.[0-9]+)*)/.exec(versionName.trim());
  return match?.[1] || versionName.trim() || 'unknown';
}

function androidEnvironmentLabel(build: AndroidBuild, packageName: string): string {
  if (build.environment) {
    return build.environment;
  }

  const suffix = packageName.split('.').pop() || '';
  return ['qa', 'stage', 'dev'].includes(suffix) ? suffix : 'prod';
}

/**
 * Copies the apk into `<artifactRoot>/<version>/<environment>/` with a
 * build-info.json beside it, so it is always obvious which build a run used.
 */
function publishAndroidArtifact(
  apkPath: string,
  resolved: ResolvedAndroidConfig,
  origin: Record<string, unknown>
): string {
  const info = readApkInfo(apkPath);
  const versionFolder = androidVersionFolder(info.versionName);
  const environment = androidEnvironmentLabel(resolved.build, info.packageName);
  const destinationDir = path.resolve(process.cwd(), resolved.artifactRoot, versionFolder, environment);

  mkdirSync(destinationDir, { recursive: true });
  const destination = path.join(destinationDir, 'app.apk');
  copyFileSync(apkPath, destination);

  writeFileSync(
    path.join(destinationDir, 'build-info.json'),
    `${JSON.stringify(
      {
        version: versionFolder,
        versionName: info.versionName,
        versionCode: info.versionCode,
        environment,
        appPackage: info.packageName || resolved.build.appPackage || '',
        build: resolved.name,
        source: resolved.build.source || 'local',
        artifact: 'app.apk',
        ...origin,
        publishedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`
  );

  console.log(
    `[mobile] published ${environment} ${info.versionName || versionFolder} (${info.versionCode}) to ${destination}`
  );
  return destination;
}

/**
 * Mints an OAuth token for the App Distribution API. Prefers an existing token
 * so CI can hand one in, otherwise signs a JWT with a service account key.
 */
function firebaseAccessToken(firebase: AndroidFirebaseConfig): string {
  const existing = process.env.FIREBASE_ACCESS_TOKEN || process.env.GOOGLE_OAUTH_ACCESS_TOKEN || firebase.accessToken;
  if (existing) {
    return existing;
  }

  const keyFile = process.env.MOBILE_FIREBASE_KEY_FILE || firebase.serviceAccountKeyFile;
  if (!keyFile) {
    throw new Error(
      'Firebase builds need credentials. Either export FIREBASE_ACCESS_TOKEN='
        + '"$(gcloud auth print-access-token)" or set android.firebase.serviceAccountKeyFile in '
        + `${ANDROID_CONFIG_PATH} to a service account json with the Firebase App Distribution Admin role.`
    );
  }

  const keyPath = path.resolve(process.cwd(), keyFile);
  if (!existsSync(keyPath)) {
    throw new Error(`The configured Firebase service account key does not exist: ${keyPath}`);
  }

  const key = JSON.parse(readFileSync(keyPath, 'utf8')) as { client_email?: string; private_key?: string };
  if (!key.client_email || !key.private_key) {
    throw new Error(`${keyPath} is not a service account key (client_email/private_key missing).`);
  }

  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  const claim = encode({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  });

  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${claim}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');

  const response = execFileSync(
    'curl',
    [
      '--fail', '--location', '--silent', '--show-error',
      '--data-urlencode', 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer',
      '--data-urlencode', `assertion=${unsigned}.${signature}`,
      'https://oauth2.googleapis.com/token'
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
  );

  const token = (JSON.parse(response) as { access_token?: string }).access_token;
  if (!token) {
    throw new Error('Google did not return an access token for the service account key.');
  }

  return token;
}

interface FirebaseRelease {
  name?: string;
  displayVersion?: string;
  buildVersion?: string;
  createTime?: string;
  binaryDownloadUri?: string;
}

/**
 * Picks a release from App Distribution. Releases come back newest first, so an
 * unset selector takes the latest build for that app id.
 */
function findFirebaseRelease(appId: string, wanted: string, accessToken: string): FirebaseRelease {
  // The app id carries the project number: 1:<projectNumber>:android:<hash>.
  const projectNumber = appId.split(':')[1];
  if (!projectNumber) {
    throw new Error(`"${appId}" is not a Firebase app id (expected 1:<projectNumber>:android:<hash>).`);
  }

  const url = `https://firebaseappdistribution.googleapis.com/v1/projects/${projectNumber}/apps/${appId}`
    + '/releases?pageSize=100&orderBy=createTime%20desc';
  const releases = (curlJson(url, accessToken) as { releases?: FirebaseRelease[] }).releases || [];

  if (releases.length === 0) {
    throw new Error(`Firebase App Distribution has no releases for app ${appId}.`);
  }

  if (!wanted || wanted.toLowerCase() === 'latest') {
    return releases[0];
  }

  const match = releases.find((release) => {
    const display = release.displayVersion || '';
    const buildVersion = release.buildVersion || '';
    return (
      wanted === display
      || wanted === buildVersion
      || wanted === `${display} (${buildVersion})`
      || release.name?.endsWith(`/${wanted}`)
    );
  });

  if (!match) {
    const available = releases
      .slice(0, 10)
      .map((release) => `${release.displayVersion} (${release.buildVersion})`)
      .join(', ');
    throw new Error(`No Firebase release "${wanted}" for app ${appId}. Latest releases: ${available}`);
  }

  return match;
}

function downloadFirebaseRelease(resolved: ResolvedAndroidConfig): string {
  const appId = process.env.MOBILE_ANDROID_FIREBASE_APP_ID || resolved.build.firebase?.appId;
  if (!appId) {
    throw new Error(
      `A firebase build needs "firebase.appId" in ${ANDROID_CONFIG_PATH} (or MOBILE_ANDROID_FIREBASE_APP_ID).`
    );
  }

  const wanted = process.env.MOBILE_ANDROID_FIREBASE_RELEASE || resolved.build.firebase?.release || 'latest';
  const accessToken = firebaseAccessToken(resolved.firebase);
  const release = findFirebaseRelease(appId, wanted, accessToken);

  if (!release.binaryDownloadUri) {
    throw new Error(
      `Firebase release ${release.displayVersion} (${release.buildVersion}) has no downloadable binary. `
        + 'Releases distributed as an app bundle through Google Play can only be installed from the tester app.'
    );
  }

  const cacheDir = path.resolve(process.cwd(), IPA_CACHE_DIR);
  const slug = `${appId.split(':').pop()}-${release.displayVersion}-${release.buildVersion}`.replace(/[^a-zA-Z0-9.-]+/g, '-');
  const target = path.join(cacheDir, `${slug}.apk`);

  if (!existsSync(target) || process.env.MOBILE_ANDROID_REFRESH === 'true') {
    console.log(`[mobile] downloading Firebase release ${release.displayVersion} (${release.buildVersion})`);
    // The signed uri already carries its own credentials and expires in an hour.
    downloadFile(release.binaryDownloadUri, target);
  } else {
    console.log(`[mobile] reusing ${target} (set MOBILE_ANDROID_REFRESH=true to re-download)`);
  }

  process.env.MOBILE_ANDROID_FIREBASE_RELEASE_NAME = release.name || '';
  return target;
}

/**
 * Drives the Playwright downloader in a child process, because it is async and
 * the capability resolution wdio calls is not. Used when the App Distribution
 * API is not available, for example without a project role.
 */
function downloadFirebaseReleaseWithBrowser(resolved: ResolvedAndroidConfig): string {
  const resultPath = path.resolve(process.cwd(), IPA_CACHE_DIR, 'firebase-download.json');
  mkdirSync(path.dirname(resultPath), { recursive: true });
  rmSync(resultPath, { force: true });

  console.log('[mobile] fetching the build from the App Distribution page with Playwright');
  execFileSync(
    'npx',
    ['ts-node', 'scripts/download-firebase-build.ts', '--build', resolved.name, '--result', resultPath],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        MOBILE_ANDROID_BUILD: resolved.name,
        // wdio workers point TS_NODE_PROJECT at mobile/tsconfig.json, which does not
        // cover scripts/; type-checking the helper there fails on ts-node's own preamble.
        TS_NODE_PROJECT: path.resolve(process.cwd(), 'tsconfig.json'),
        TS_NODE_TRANSPILE_ONLY: 'true',
      },
    }
  );

  if (!existsSync(resultPath)) {
    throw new Error('The Playwright downloader did not produce a build.');
  }

  const result = JSON.parse(readFileSync(resultPath, 'utf8')) as { path?: string; firebaseRelease?: string };
  if (!result.path || !existsSync(result.path)) {
    throw new Error(`The downloaded build is missing: ${result.path}`);
  }

  process.env.MOBILE_ANDROID_FIREBASE_RELEASE_NAME = result.firebaseRelease || '';
  return result.path;
}

/**
 * Appium can only install an apk, so an app bundle is converted to a universal
 * apk first. bundletool signs it with the local debug keystore.
 */
function ensureApk(archive: string, resolved: ResolvedAndroidConfig): string {
  const listing = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const isBundle = listing.split('\n').some((entry) => entry.trim() === 'BundleConfig.pb');

  if (!isBundle) {
    return archive;
  }

  if (!resolved.bundletoolJar) {
    throw new Error(
      `${archive} is an app bundle (.aab). Set android.bundletoolJar in ${ANDROID_CONFIG_PATH} `
        + '(or MOBILE_BUNDLETOOL_JAR) to a bundletool jar so it can be converted to a universal apk. '
        + 'Download it from https://github.com/google/bundletool/releases'
    );
  }

  const jar = path.resolve(process.cwd(), resolved.bundletoolJar);
  if (!existsSync(jar)) {
    throw new Error(`The configured bundletool jar does not exist: ${jar}`);
  }

  const workDir = path.resolve(process.cwd(), IPA_CACHE_DIR, 'bundletool');
  const apks = path.join(workDir, `${path.basename(archive, path.extname(archive))}.apks`);
  const extracted = path.join(workDir, path.basename(archive, path.extname(archive)));
  const universal = path.join(extracted, 'universal.apk');

  if (existsSync(universal)) {
    return universal;
  }

  mkdirSync(workDir, { recursive: true });
  console.log('[mobile] converting the app bundle to a universal apk with bundletool');
  execFileSync(
    'java',
    ['-jar', jar, 'build-apks', `--bundle=${archive}`, `--output=${apks}`, '--mode=universal', '--overwrite'],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  );
  execFileSync('unzip', ['-o', apks, 'universal.apk', '-d', extracted], { stdio: ['ignore', 'ignore', 'inherit'] });

  if (!existsSync(universal)) {
    throw new Error(`bundletool produced no universal.apk in ${extracted}`);
  }

  return universal;
}

/**
 * Returns the apk to install: a local file, a downloaded url, or the Firebase
 * App Distribution release, always republished under its own version folder.
 */
function resolveAndroidAppPath(resolved: ResolvedAndroidConfig): string {
  if (process.env.MOBILE_ANDROID_APP_PATH) {
    return path.resolve(process.cwd(), process.env.MOBILE_ANDROID_APP_PATH);
  }

  const build = resolved.build;
  const source = (build.source || 'local').toLowerCase() as AndroidSource;

  if (source === 'firebase') {
    const downloaded = downloadFirebaseRelease(resolved);
    const releaseName = process.env.MOBILE_ANDROID_FIREBASE_RELEASE_NAME || '';
    return publishAndroidArtifact(ensureApk(downloaded, resolved), resolved, {
      firebaseAppId: process.env.MOBILE_ANDROID_FIREBASE_APP_ID || build.firebase?.appId || '',
      firebaseRelease: releaseName
    });
  }

  if (source === 'firebase-web') {
    const downloaded = downloadFirebaseReleaseWithBrowser(resolved);
    return publishAndroidArtifact(ensureApk(downloaded, resolved), resolved, {
      firebaseWebUrl: build.firebase?.webUrl || resolved.firebase.webUrl || '',
      firebaseRelease: process.env.MOBILE_ANDROID_FIREBASE_RELEASE_NAME || ''
    });
  }

  if (source === 'url') {
    const url = process.env.MOBILE_ANDROID_APP_URL || build.appUrl;
    if (!url) {
      throw new Error(`A url build needs "appUrl" in ${ANDROID_CONFIG_PATH} (or MOBILE_ANDROID_APP_URL).`);
    }

    const target = path.resolve(process.cwd(), IPA_CACHE_DIR, path.basename(new URL(url).pathname) || 'app.apk');
    if (!existsSync(target)) {
      console.log(`[mobile] downloading Android build to ${target}`);
      downloadFile(url, target, process.env.MOBILE_ANDROID_AUTH_HEADER || build.authHeader);
    }

    return publishAndroidArtifact(ensureApk(target, resolved), resolved, { sourceUrl: url });
  }

  const local = path.resolve(process.cwd(), build.appPath || `${DEFAULT_ANDROID_ARTIFACT_ROOT}/app.apk`);
  if (!existsSync(local)) {
    throw new Error(`The configured Android appPath does not exist: ${local}`);
  }

  // A file that already sits in a published version folder is used as-is.
  if (path.basename(path.dirname(path.dirname(path.dirname(local)))) === path.basename(resolved.artifactRoot)) {
    return local;
  }

  return publishAndroidArtifact(ensureApk(local, resolved), resolved, { sourceFile: local });
}

/** Files an apk that was fetched elsewhere into the versioned artifact folder. */
export function publishAndroidBuild(apkPath: string, origin: Record<string, unknown> = {}): string {
  const resolved = resolveAndroidBuild();
  return publishAndroidArtifact(ensureApk(path.resolve(process.cwd(), apkPath), resolved), resolved, origin);
}

/** Reads the named build (or the configured default) out of the iOS config. */
function resolveIOSBuild(): ResolvedIOSConfig {
  const empty: ResolvedIOSConfig = { build: {}, repo: {}, artifactRoot: DEFAULT_ARTIFACT_ROOT };
  const configPath = path.resolve(process.cwd(), IOS_CONFIG_PATH);
  if (!existsSync(configPath)) {
    return empty;
  }

  const parsed = YAML.parse(readFileSync(configPath, 'utf8')) as { ios?: IOSBuildConfig } | undefined;
  const config = parsed?.ios;
  if (!config?.builds) {
    return empty;
  }

  const name = process.env.MOBILE_IOS_BUILD || config.defaultBuild;
  if (!name) {
    return empty;
  }

  const build = config.builds[name];
  if (!build) {
    throw new Error(
      `Unknown iOS build "${name}". Available builds in ${IOS_CONFIG_PATH}: ${Object.keys(config.builds).join(', ')}`
    );
  }

  console.log(`[mobile] using iOS build "${name}" (source: ${build.source || 'simulator'})`);

  return {
    build: decryptObjectSecrets(build),
    repo: config.repo || {},
    artifactRoot: config.artifactRoot || DEFAULT_ARTIFACT_ROOT
  };
}

function resolveIOSMode(build: IOSBuild): IOSMode {
  if (process.env.MOBILE_IOS_MODE) {
    const override = process.env.MOBILE_IOS_MODE.toLowerCase();
    return override === 'simulator' ? 'simulator' : override === 'real-device' ? 'real-device' : 'testflight';
  }

  // An xcode build compiles from the app repo, so the target decides where it runs.
  if (build.source === 'xcode') {
    return resolveXcodeTarget(build) === 'device' ? 'real-device' : 'simulator';
  }

  const source = (build.source || 'simulator').toLowerCase();
  if (source === 'simulator') {
    return 'simulator';
  }

  return source === 'ipa' ? 'real-device' : 'testflight';
}

function resolveXcodeTarget(build: IOSBuild): XcodeTarget {
  const value = (process.env.MOBILE_IOS_XCODE_TARGET || build.xcode?.target || 'simulator').toLowerCase();
  return value === 'device' ? 'device' : 'simulator';
}

function requireXcodeConfig(build: IOSBuild): Required<Pick<IOSXcodeConfig, 'scheme'>> & IOSXcodeConfig {
  const xcode = build.xcode;
  if (!xcode?.scheme) {
    throw new Error(`An xcode build needs an "xcode.scheme" entry in ${IOS_CONFIG_PATH}.`);
  }

  return xcode as Required<Pick<IOSXcodeConfig, 'scheme'>> & IOSXcodeConfig;
}

function compareVersions(a: string, b: string): number {
  const left = a.split('.').map((part) => Number(part) || 0);
  const right = b.split('.').map((part) => Number(part) || 0);

  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

/**
 * Finds the app clone to build from. Clone folders are named after the release
 * (SuperApp-iOS-30.3), so the folder name is what selects the version and the
 * newest one wins unless a version is pinned.
 */
function resolveRepoCheckout(repo: IOSRepoConfig, xcode: IOSXcodeConfig): { projectPath: string; version: string } {
  const explicit = xcode.workspacePath || xcode.projectPath;
  if (explicit) {
    const resolved = path.resolve(process.cwd(), explicit);
    const folder = path.basename(path.dirname(resolved));
    const prefix = repo.folderPrefix || 'SuperApp-iOS-';
    return { projectPath: resolved, version: folder.startsWith(prefix) ? folder.slice(prefix.length) : 'unknown' };
  }

  const root = process.env.MOBILE_IOS_REPO_ROOT || repo.root;
  if (!root) {
    throw new Error(
      `An xcode build needs "ios.repo.root" (or xcode.projectPath) in ${IOS_CONFIG_PATH} so the app clone can be found.`
    );
  }

  const rootPath = path.resolve(process.cwd(), root);
  if (!existsSync(rootPath)) {
    throw new Error(`The configured iOS repo root does not exist: ${rootPath}`);
  }

  const prefix = repo.folderPrefix || 'SuperApp-iOS-';
  const projectName = repo.projectName || 'SuperApp.xcodeproj';
  const candidates = readdirSync(rootPath)
    .filter((entry) => entry.startsWith(prefix) && statSync(path.join(rootPath, entry)).isDirectory())
    .map((entry) => ({ folder: entry, version: entry.slice(prefix.length) }))
    .filter((candidate) => existsSync(path.join(rootPath, candidate.folder, projectName)));

  if (candidates.length === 0) {
    throw new Error(`No "${prefix}<version>" clone containing ${projectName} was found under ${rootPath}`);
  }

  const wanted = process.env.MOBILE_IOS_REPO_VERSION || repo.version;
  const picked = wanted
    ? candidates.find((candidate) => candidate.version === wanted)
    : candidates.sort((a, b) => compareVersions(b.version, a.version))[0];

  if (!picked) {
    throw new Error(
      `No clone for version "${wanted}" under ${rootPath}. Available: ${candidates.map((c) => c.version).join(', ')}`
    );
  }

  console.log(`[mobile] app source: ${path.join(rootPath, picked.folder)} (folder version ${picked.version})`);
  return { projectPath: path.join(rootPath, picked.folder, projectName), version: picked.version };
}

function plistValue(plistPath: string, key: string): string {
  try {
    return execFileSync('plutil', ['-extract', key, 'raw', '-o', '-', plistPath], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** Reads the version out of the built artifact, which is more accurate than the folder name. */
function readArtifactVersion(artifact: string): { version: string; buildNumber: string } {
  let plistPath = path.join(artifact, 'Info.plist');

  if (artifact.endsWith('.ipa')) {
    const listing = execFileSync('unzip', ['-Z1', artifact], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const entry = listing.split('\n').find((line) => /^Payload\/[^/]+\.app\/Info\.plist$/.test(line.trim()));
    if (!entry) {
      return { version: '', buildNumber: '' };
    }

    const extracted = path.resolve(process.cwd(), IPA_CACHE_DIR, 'ipa-info.plist');
    mkdirSync(path.dirname(extracted), { recursive: true });
    writeFileSync(extracted, execFileSync('unzip', ['-p', artifact, entry.trim()], { maxBuffer: 32 * 1024 * 1024 }));
    plistPath = extracted;
  }

  return {
    version: plistValue(plistPath, 'CFBundleShortVersionString'),
    buildNumber: plistValue(plistPath, 'CFBundleVersion')
  };
}

function resolveEnvironmentLabel(build: IOSBuild, configuration: string): string {
  if (build.environment) {
    return build.environment;
  }

  return configuration.toLowerCase() === 'release' ? 'prod' : configuration.toLowerCase();
}

function readGitInfo(projectPath: string): { branch: string; commit: string } {
  const repoDir = path.dirname(projectPath);

  const read = (args: string[]): string => {
    try {
      return execFileSync('git', ['-C', repoDir, ...args], { encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  };

  return { branch: read(['rev-parse', '--abbrev-ref', 'HEAD']), commit: read(['rev-parse', '--short', 'HEAD']) };
}

/**
 * Copies the freshly built artifact into `<artifactRoot>/<version>/<environment>/`
 * and drops a build-info.json beside it, so it is always obvious which build the
 * framework is currently testing against.
 */
function publishArtifact(
  artifact: string,
  artifactRoot: string,
  build: IOSBuild,
  xcode: IOSXcodeConfig,
  checkout: { projectPath: string; version: string },
  target: XcodeTarget
): string {
  const configuration = xcode.configuration || 'QA';
  const { version, buildNumber } = readArtifactVersion(artifact);
  const versionFolder = version || checkout.version || 'unknown';
  const environment = resolveEnvironmentLabel(build, configuration);
  const destinationDir = path.resolve(process.cwd(), artifactRoot, versionFolder, environment);

  mkdirSync(destinationDir, { recursive: true });
  const destination = path.join(destinationDir, path.basename(artifact));

  if (artifact.endsWith('.app')) {
    // ditto keeps the bundle structure and symlinks intact, which cp -R does not.
    rmSync(destination, { recursive: true, force: true });
    execFileSync('ditto', [artifact, destination]);
  } else {
    copyFileSync(artifact, destination);
  }

  const git = readGitInfo(checkout.projectPath);
  writeFileSync(
    path.join(destinationDir, 'build-info.json'),
    `${JSON.stringify(
      {
        version: versionFolder,
        buildNumber,
        environment,
        bundleId: build.bundleId || '',
        scheme: xcode.scheme || '',
        configuration,
        target,
        artifact: path.basename(artifact),
        sourceRepo: path.dirname(checkout.projectPath),
        gitBranch: git.branch,
        gitCommit: git.commit,
        builtAt: new Date().toISOString()
      },
      null,
      2
    )}\n`
  );

  console.log(`[mobile] published ${environment} ${versionFolder} (${buildNumber}) to ${destination}`);
  return destination;
}

function xcodeSlug(scheme: string): string {
  return scheme.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Runs xcodebuild with its very chatty output captured to a log file. */
function runXcodebuild(args: string[], logPath: string): void {
  mkdirSync(path.dirname(logPath), { recursive: true });
  const logFd = openSync(logPath, 'w');

  try {
    execFileSync('xcodebuild', args, { stdio: ['ignore', logFd, logFd] });
  } catch {
    const tail = readFileSync(logPath, 'utf8').split('\n').slice(-30).join('\n');
    throw new Error(`xcodebuild failed. Full log: ${logPath}\n${tail}`);
  } finally {
    closeSync(logFd);
  }
}

function findArtifact(directory: string, extension: string): string | undefined {
  if (!existsSync(directory)) {
    return undefined;
  }

  const match = readdirSync(directory).find((entry) => entry.endsWith(extension));
  return match ? path.join(directory, match) : undefined;
}

/**
 * Builds the app straight from the checked-out Xcode project, so a run always
 * exercises the current working copy instead of a stale copied artifact.
 */
function buildWithXcode(resolved: ResolvedIOSConfig): string {
  const { build, repo, artifactRoot } = resolved;
  const xcode = requireXcodeConfig(build);
  const target = resolveXcodeTarget(build);
  const configuration = xcode.configuration || 'QA';
  const checkout = resolveRepoCheckout(repo, xcode);
  const slug = xcodeSlug(xcode.scheme);
  const buildsDir = path.resolve(process.cwd(), IPA_CACHE_DIR);
  // Keying derived data by version stops a new release reusing the previous
  // release's products.
  const derivedDataPath = path.resolve(
    process.cwd(),
    xcode.derivedDataPath || path.join(IPA_CACHE_DIR, 'derived-data', checkout.version, slug)
  );

  const projectArgs = checkout.projectPath.endsWith('.xcworkspace')
    ? ['-workspace', checkout.projectPath]
    : ['-project', checkout.projectPath];
  const baseArgs = [...projectArgs, '-scheme', xcode.scheme, '-configuration', configuration];

  const rebuild = (process.env.MOBILE_IOS_XCODE_BUILD || xcode.build || 'missing').toLowerCase() === 'always';

  if (target === 'simulator') {
    const productsDir = path.join(derivedDataPath, 'Build', 'Products', `${configuration}-iphonesimulator`);
    const cached = xcode.productName
      ? path.join(productsDir, `${xcode.productName}.app`)
      : findArtifact(productsDir, '.app');

    if (!rebuild && cached && existsSync(cached)) {
      console.log(`[mobile] reusing ${cached} (set MOBILE_IOS_XCODE_BUILD=always to rebuild)`);
      return publishArtifact(cached, artifactRoot, build, xcode, checkout, target);
    }

    console.log(`[mobile] building "${xcode.scheme}" ${checkout.version} for the simulator, this takes a few minutes`);
    runXcodebuild(
      [
        ...baseArgs,
        '-destination', 'generic/platform=iOS Simulator',
        '-derivedDataPath', derivedDataPath,
        ...(xcode.codeSigning === false ? ['CODE_SIGNING_ALLOWED=NO'] : []),
        'build'
      ],
      path.join(buildsDir, `${slug}-simulator.log`)
    );

    const built = xcode.productName
      ? path.join(productsDir, `${xcode.productName}.app`)
      : findArtifact(productsDir, '.app');

    if (!built || !existsSync(built)) {
      throw new Error(`xcodebuild finished but no .app was found in ${productsDir}`);
    }

    return publishArtifact(built, artifactRoot, build, xcode, checkout, target);
  }

  const archivePath = path.join(buildsDir, `${checkout.version}-${slug}.xcarchive`);
  const exportPath = path.join(buildsDir, `${checkout.version}-${slug}-export`);
  const cachedIpa = findArtifact(exportPath, '.ipa');

  if (!rebuild && cachedIpa) {
    console.log(`[mobile] reusing ${cachedIpa} (set MOBILE_IOS_XCODE_BUILD=always to rebuild)`);
    return publishArtifact(cachedIpa, artifactRoot, build, xcode, checkout, target);
  }

  console.log(`[mobile] archiving "${xcode.scheme}" ${checkout.version} for a device, this takes a few minutes`);
  runXcodebuild(
    [...baseArgs, '-destination', 'generic/platform=iOS', '-archivePath', archivePath, 'archive'],
    path.join(buildsDir, `${slug}-archive.log`)
  );

  const teamId = process.env.MOBILE_IOS_TEAM_ID || xcode.teamId;
  const exportOptionsPath = path.join(buildsDir, `${slug}-export-options.plist`);
  writeFileSync(
    exportOptionsPath,
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      '<dict>',
      '  <key>method</key>',
      `  <string>${xcode.exportMethod || 'development'}</string>`,
      '  <key>signingStyle</key>',
      '  <string>automatic</string>',
      ...(teamId ? ['  <key>teamID</key>', `  <string>${teamId}</string>`] : []),
      '  <key>destination</key>',
      '  <string>export</string>',
      '</dict>',
      '</plist>',
      ''
    ].join('\n')
  );

  runXcodebuild(
    ['-exportArchive', '-archivePath', archivePath, '-exportPath', exportPath, '-exportOptionsPlist', exportOptionsPath],
    path.join(buildsDir, `${slug}-export.log`)
  );

  const ipa = findArtifact(exportPath, '.ipa');
  if (!ipa) {
    throw new Error(`xcodebuild exported no .ipa into ${exportPath}`);
  }

  return publishArtifact(ipa, artifactRoot, build, xcode, checkout, target);
}

function resolveIOSAppPath(resolved: ResolvedIOSConfig): string {
  if (process.env.MOBILE_IOS_APP_PATH) {
    return path.resolve(process.cwd(), process.env.MOBILE_IOS_APP_PATH);
  }

  if (resolved.build.source === 'xcode') {
    return buildWithXcode(resolved);
  }

  return path.resolve(process.cwd(), resolved.build.appPath || 'test-data/mobile-app/gri/ios/app.app');
}

/**
 * Returns a local .ipa, building it from the Xcode project or downloading it
 * when the build only names a URL. Cached under mobile/.builds.
 */
function resolveIpaPath(resolved: ResolvedIOSConfig): string {
  const build = resolved.build;
  const configured = process.env.MOBILE_IOS_IPA_PATH || build.ipaPath;
  if (configured) {
    const path_ = path.resolve(process.cwd(), configured);
    if (!existsSync(path_)) {
      throw new Error(`The configured iOS ipaPath does not exist: ${path_}`);
    }
    return path_;
  }

  if (build.source === 'xcode') {
    return buildWithXcode(resolved);
  }

  const url = process.env.MOBILE_IOS_IPA_URL || build.ipaUrl;
  if (!url) {
    throw new Error(
      `This iOS build needs either ipaPath or ipaUrl in ${IOS_CONFIG_PATH} (or MOBILE_IOS_IPA_PATH / MOBILE_IOS_IPA_URL).`
    );
  }

  const cacheDir = path.resolve(process.cwd(), IPA_CACHE_DIR);
  mkdirSync(cacheDir, { recursive: true });

  const fileName = path.basename(new URL(url).pathname) || 'build.ipa';
  const target = path.join(cacheDir, fileName);

  if (existsSync(target)) {
    return target;
  }

  const authHeader = process.env.MOBILE_IOS_IPA_AUTH_HEADER || build.ipaAuthHeader;

  console.log(`[mobile] downloading iOS build to ${target}`);
  downloadFile(url, target, authHeader);

  return target;
}

function resolveIOSPlatformVersion(): string {
  if (process.env.MOBILE_IOS_PLATFORM_VERSION) {
    return process.env.MOBILE_IOS_PLATFORM_VERSION;
  }

  try {
    const runtimes = execSync('xcrun simctl list runtimes', { encoding: 'utf8' });
    const match = runtimes.match(/iOS\s+([0-9]+(?:\.[0-9]+)?)/i);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    // Fall through to a known-good default below.
  }

  return '26.3';
}

export function resolveMobileCapabilities(): MobileCapabilities {
  const platform = resolvePlatform();

  if (platform === 'ios') {
    const resolved = resolveIOSBuild();
    const build = resolved.build;
    const iosMode = resolveIOSMode(build);
    const bundleId = process.env.MOBILE_IOS_BUNDLE_ID || build.bundleId || '';

    if (!bundleId) {
      throw new Error('MOBILE_IOS_BUNDLE_ID is required when MOBILE_PLATFORM=ios.');
    }

    if (iosMode === 'simulator') {
      const appPath = resolveIOSAppPath(resolved);

      if (!existsSync(appPath)) {
        throw new Error(`MOBILE_IOS_APP_PATH does not exist: ${appPath}`);
      }

      return {
        platformName: 'iOS',
        'appium:automationName': 'XCUITest',
        'appium:deviceName': process.env.MOBILE_IOS_DEVICE_NAME || build.deviceName || 'iPhone 17',
        'appium:platformVersion': resolveIOSPlatformVersion(),
        'appium:app': appPath,
        'appium:bundleId': bundleId,
        'appium:noReset': false,
        'appium:autoAcceptAlerts': true,
        // The software keyboard covers the lower half of the create-account form
        // and cannot be dismissed reliably, so type through the hardware keyboard.
        'appium:connectHardwareKeyboard': process.env.MOBILE_IOS_HW_KEYBOARD !== 'false',
        'appium:forceSimulatorSoftwareKeyboardPresence': false,
        // Verification specs pause for minutes while polling an inbox, and Appium
        // would otherwise drop the session after 60s without a command.
        'appium:newCommandTimeout': Number(process.env.MOBILE_NEW_COMMAND_TIMEOUT || 1800),
        'appium:wdaLaunchTimeout': 240000,
        'appium:wdaConnectionTimeout': 240000,
        'mobile:mode': iosMode,
        'mobile:target': 'simulator'
      };
    }

    const udid = process.env.MOBILE_IOS_DEVICE_UDID || build.deviceUdid;
    if (!udid) {
      throw new Error(
        'A real device UDID is required for ipa and testflight builds. Set deviceUdid in '
          + `${IOS_CONFIG_PATH} or MOBILE_IOS_DEVICE_UDID.`
      );
    }

    // TestFlight installs the build by hand on the device, so the session only
    // launches the existing bundle. ipa and xcode builds are installed by Appium.
    const isIpaBuild = build.source === 'ipa'
      || (build.source === 'xcode' && resolveXcodeTarget(build) === 'device')
      || Boolean(process.env.MOBILE_IOS_IPA_PATH || process.env.MOBILE_IOS_IPA_URL);

    return {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': process.env.MOBILE_IOS_DEVICE_NAME || build.deviceName || 'iPhone 17',
      'appium:platformVersion': resolveIOSPlatformVersion(),
      ...(isIpaBuild ? { 'appium:app': resolveIpaPath(resolved) } : {}),
      'appium:bundleId': bundleId,
      'appium:udid': udid,
      'appium:noReset': !isIpaBuild,
      'appium:autoAcceptAlerts': true,
      'appium:connectHardwareKeyboard': false,
      'appium:newCommandTimeout': Number(process.env.MOBILE_NEW_COMMAND_TIMEOUT || 1800),
      'appium:wdaLaunchTimeout': 240000,
      'appium:wdaConnectionTimeout': 240000,
      'mobile:mode': iosMode,
      'mobile:target': 'real-device'
    };
  }

  const android = resolveAndroidBuild();

  return {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.MOBILE_ANDROID_DEVICE_NAME || 'Android Emulator',
    'appium:platformVersion': process.env.MOBILE_ANDROID_PLATFORM_VERSION || '16',
    'appium:app': resolveAndroidAppPath(android),
    'appium:appPackage':
      process.env.MOBILE_APP_PACKAGE || android.build.appPackage || 'com.guaranteedrate.superapp.qa',
    'appium:appActivity':
      process.env.MOBILE_APP_ACTIVITY || android.build.appActivity || 'com.guaranteedrate.superapp.MainActivity',
    'appium:noReset': false,
    'appium:autoGrantPermissions': true,
    // Verification specs pause for minutes while polling an inbox, and Appium
    // would otherwise drop the session after 60s without a command.
    'appium:newCommandTimeout': Number(process.env.MOBILE_NEW_COMMAND_TIMEOUT || 1800)
  };
}

export function resolveMobilePlatform(): MobilePlatform {
  return resolvePlatform();
}