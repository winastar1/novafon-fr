import re, subprocess, pathlib, hashlib
css = pathlib.Path('/tmp/gf.css').read_text()
parts = re.findall(r"/\* ([\w-]+) \*/\s*(@font-face \{.*?\})", css, re.S)
groups = {}
for subset, block in parts:
    if subset not in ('latin', 'latin-ext'):
        continue
    fam = re.search(r"font-family: '([^']+)'", block).group(1)
    style = re.search(r"font-style: (\w+)", block).group(1)
    weight = int(re.search(r"font-weight: (\d+)", block).group(1))
    url = re.search(r"url\((https://[^)]+)\)", block).group(1)
    ur = re.search(r"unicode-range: ([^;]+);", block).group(1)
    g = groups.setdefault((fam, style, subset), {'w': [], 'url': url, 'ur': ur})
    g['w'].append(weight)

dest = pathlib.Path('assets/fonts'); dest.mkdir(parents=True, exist_ok=True)
for f in dest.glob('*.woff2'): f.unlink()
blocks = []
for (fam, style, subset), g in groups.items():
    name = f"{fam.lower()}-{style}-{subset}.woff2"
    subprocess.run(['curl', '-sSfL', '-o', str(dest/name), g['url']], check=True)
    lo, hi = min(g['w']), max(g['w'])
    blocks.append(
        "@font-face{\n"
        f"  font-family:'{fam}';\n"
        f"  font-style:{style};\n"
        f"  font-weight:{lo} {hi};\n"
        "  font-display:swap;\n"
        f"  src:url(../fonts/{name}) format('woff2');\n"
        f"  unicode-range:{g['ur']};\n"
        "}"
    )
header = ("/* NOVAFON France — polices AUTO-HEBERGEES (RGPD : plus aucun appel a fonts.googleapis.com\n"
          "   ni fonts.gstatic.com, donc plus de transfert d'adresse IP vers Google).\n"
          "   Outfit & Cormorant : Google Fonts, licence SIL Open Font License 1.1.\n"
          "   Fichiers variables (une seule graisse fichier couvre toute la plage), sous-ensembles\n"
          "   latin + latin-ext uniquement. Regenerer via scripts/novafon_fonts.py si besoin. */\n")
pathlib.Path('assets/css').mkdir(parents=True, exist_ok=True)
pathlib.Path('assets/css/fonts.css').write_text(header + "\n" + "\n\n".join(blocks) + "\n")
print("OK", len(blocks), "faces")
