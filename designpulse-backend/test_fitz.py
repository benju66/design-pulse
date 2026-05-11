import fitz

doc = fitz.open()
page = doc.new_page(width=100, height=200)
print(f"Original: rect={page.rect}, cropbox={page.cropbox}, rotation={page.rotation}")

page.set_rotation(90)
print(f"Rotated 90: rect={page.rect}, cropbox={page.cropbox}, rotation={page.rotation}")

page.set_cropbox(fitz.Rect(10, 10, 90, 190))
print(f"Cropbox (10,10,90,190): rect={page.rect}, cropbox={page.cropbox}, rotation={page.rotation}")
