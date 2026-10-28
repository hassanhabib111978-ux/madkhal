from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
html = (root / "index.html").read_text(encoding="utf-8")
pattern = re.compile(r'<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</script\\s*>', re.I)
out = Path("/tmp/madkhal-inline-scripts")
out.mkdir(parents=True, exist_ok=True)
for old in out.glob("*.js"):
    old.unlink()
count = 0
for count, match in enumerate(pattern.finditer(html), start=1):
    source = match.group(1)
    if source.strip():
        (out / f"inline-{count}.js").write_text(source, encoding="utf-8")
print(f"Extracted {count} inline script blocks to {out}")
