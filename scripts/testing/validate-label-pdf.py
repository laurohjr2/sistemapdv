"""Decode rasterized label PDFs with an independent reader (test-only dependencies)."""
import sys
from pathlib import Path
from PIL import Image
import zxingcpp

folder = Path(sys.argv[1] if len(sys.argv) > 1 else 'work/scale')
found = []
for page in sorted(folder.glob('labels-page-*.png')):
    decoded = [value.text for value in zxingcpp.read_barcodes(Image.open(page))]
    print(page.name, decoded)
    found.extend(decoded)
assert '4006381333931' in found
assert '5901234123457' in found
print('Leitor independente confirmou os EAN-13 originais nas duas páginas do PDF.')
