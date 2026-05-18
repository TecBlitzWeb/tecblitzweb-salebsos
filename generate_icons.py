from PIL import Image
import os

os.makedirs('icons', exist_ok=True)

favicon = Image.open('favicon.png').convert('RGBA')

for size in [192, 512]:
    img = Image.new('RGBA', (size, size), '#0a0a0f')
    padding = size // 6
    max_dim = size - 2 * padding
    bolt = favicon.copy()
    bolt.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    x = (size - bolt.width) // 2
    y = (size - bolt.height) // 2
    img.paste(bolt, (x, y), bolt)
    img.convert('RGB').save(f'icons/icon-{size}.png')
    print(f'Created icon-{size}.png')
