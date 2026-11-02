"""Sign a compiled update only with an explicitly supplied existing identity."""
import base64
import hashlib
import os
from pathlib import Path
import re
import subprocess
import tempfile


def main():
    names = ['ANDROID_UPDATE_KEYSTORE_BASE64', 'ANDROID_UPDATE_STORE_PASSWORD',
             'ANDROID_UPDATE_KEY_ALIAS', 'ANDROID_UPDATE_KEY_PASSWORD',
             'ANDROID_UPDATE_CERT_SHA256']
    missing = [name for name in names if not os.environ.get(name)]
    if missing:
        raise SystemExit('Existing update identity unavailable: ' + ', '.join(missing)
                         + '. No replacement key generated; unsigned compilation retained.')
    expected = re.sub(r'[:\s]', '', os.environ[names[4]]).lower()
    if not re.fullmatch(r'[0-9a-f]{64}', expected):
        raise SystemExit('Expected installation certificate must be a SHA-256 fingerprint.')
    sdk = Path(os.environ.get('ANDROID_SDK_ROOT') or os.environ['ANDROID_HOME'])
    signer = sdk / 'build-tools/36.0.0/apksigner'
    source = Path('app/build/outputs/apk/release/app-release-unsigned.apk')
    target = Path('app/build/outputs/apk/debug/app-debug.apk')
    with tempfile.TemporaryDirectory(prefix='veldio-existing-key-') as directory:
        key = Path(directory) / 'existing.jks'
        key.write_bytes(base64.b64decode(os.environ[names[0]], validate=True))
        key.chmod(0o600)
        result = subprocess.run(['keytool', '-exportcert', '-alias', os.environ[names[2]],
                                 '-keystore', str(key), '-storepass:env', names[1]],
                                capture_output=True, check=True)
        if hashlib.sha256(result.stdout).hexdigest() != expected:
            raise SystemExit('Signing certificate differs from the existing installation; update refused.')
        target.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([str(signer), 'sign', '--ks', str(key), '--ks-key-alias', os.environ[names[2]],
                        '--ks-pass', 'env:' + names[1], '--key-pass', 'env:' + names[3],
                        '--out', str(target), str(source)], check=True)
        result = subprocess.run([str(signer), 'verify', '--print-certs', str(target)],
                                capture_output=True, text=True, check=True)
        if 'Signer #1 certificate SHA-256 digest: ' + expected not in result.stdout:
            target.unlink(missing_ok=True)
            raise SystemExit('APK signature verification failed.')
    print('APK signed and verified with the supplied existing certificate. Device update still requires verification.')


if __name__ == '__main__':
    main()
