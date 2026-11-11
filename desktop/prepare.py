"""Stage only browser assets; the built executable embeds these bytes."""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parent.parent
out = root / 'desktop' / 'web'
if out.exists(): shutil.rmtree(out)
out.mkdir()
for name in ['index.html', 'LICENSE-PDFJS.txt']:
    shutil.copy2(root / name, out / name)
shutil.copytree(root / 'dev', out / 'dev', ignore=shutil.ignore_patterns('tests', 'README.md'))
for page in [out / 'index.html', out / 'dev' / 'index.html']:
    text = page.read_text()
    page.write_text(text.replace('</body>', '<script src="/_local/runtime.js"></script></body>'))
print('Staged self-contained browser assets')
