import fitz

doc = fitz.open()
page = doc.new_page(width=100, height=200)

page.insert_text(fitz.Point(10, 20), "Hello", fontsize=10)

print("Original words:")
for w in page.get_text("words"):
    print(w[:5])

page.set_rotation(90)
print("\nRotated 90 words:")
for w in page.get_text("words"):
    print(w[:5])

