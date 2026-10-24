# Render the opening slides to PNG (and a contact sheet) from the running LED page.
# usage: python3 scripts/render-slides.py [base_url] [indices like 0,4,5 | all]   (needs playwright and Pillow)
# Writes renders/slide-NN.png and renders/contact.jpg inside this folder (renders/ is git-ignored).
import sys, os
from playwright.sync_api import sync_playwright
from PIL import Image
base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4400'
which = sys.argv[2] if len(sys.argv) > 2 else 'all'
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'renders'); os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    pg.goto(f'{base}/led?preview=slide:0'); pg.wait_for_timeout(2500)
    n = pg.evaluate("import('/assets/slides.js').then(m => m.SLIDES.length)")
    idx = range(n) if which == 'all' else [int(x) for x in which.split(',')]
    files = []
    for i in idx:
        pg.goto(f'{base}/led?preview=slide:{i}'); pg.wait_for_timeout(3600)
        f = os.path.join(out, f'slide-{i:02d}.png'); pg.screenshot(path=f); files.append(f)
    b.close()
cols = 2 if len(files) <= 4 else 3
w, h = 960, 540
sheet = Image.new('RGB', (cols * w, ((len(files) + cols - 1) // cols) * h), (255, 255, 255))
for k, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((w, h)); sheet.paste(im, ((k % cols) * w, (k // cols) * h))
sheet.save(os.path.join(out, 'contact.jpg'), quality=88)
print('\n'.join(files)); print(os.path.abspath(os.path.join(out, 'contact.jpg')))
