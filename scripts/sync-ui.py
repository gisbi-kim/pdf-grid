"""Generate the release entry and native bundle from the shared browser UI."""
from pathlib import Path
import argparse
import sys

ROOT = Path(__file__).resolve().parent.parent


def generated_files():
    shell = (ROOT / 'dev/index.html').read_text(encoding='utf-8')
    yield ROOT / 'index.html', shell.replace('<head>', '<head><base href="dev/">', 1).encode('utf-8')
    for source in sorted((ROOT / 'viewer').iterdir()):
        if source.is_file():
            yield ROOT / 'desktop-webview2/web' / source.name, source.read_bytes()
    for source in sorted((ROOT / 'dev').rglob('*')):
        if not source.is_file() or source.name == 'README.md':
            continue
        data = source.read_bytes()
        if source.name == 'index.html':
            data = shell.replace('<script defer', '<script src="/_desktop/bridge.js"></script><script defer', 1).encode('utf-8')
        yield ROOT / 'desktop-webview2/web/dev' / source.relative_to(ROOT / 'dev'), data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail if a generated file differs')
    args = parser.parse_args()
    changed = []
    for target, data in generated_files():
        if target.exists() and target.read_bytes() == data:
            continue
        changed.append(str(target.relative_to(ROOT)))
        if not args.check:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    if args.check and changed:
        print('UI bundle out of sync. Run python scripts/sync-ui.py:\n' + '\n'.join(changed))
        return 1
    print('Shared web/native UI verified.' if args.check else 'Generated ' + str(len(changed)) + ' UI files.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
