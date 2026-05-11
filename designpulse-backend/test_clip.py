import fitz

doc = fitz.open()
page = doc.new_page(width=100, height=200)

# Insert text unrotated
page.insert_text(fitz.Point(10, 20), "Hello Top Left", fontsize=10)
page.insert_text(fitz.Point(80, 180), "Hello Bottom Right", fontsize=10)

print("Original Text:\n", page.get_text("text"))

page.set_rotation(90)
print("Rotated rect:", page.rect)
# Now visually, "Hello Bottom Right" should be at the bottom left.
# Wait, if rotated 90 deg clockwise:
# original (80, 180) -> rotated (x', y')
# width=200, height=100
# let's try clipping the bottom right of the ROTATED page
# which corresponds to x=100 to 200, y=50 to 100
clip_br = fitz.Rect(100, 50, 200, 100)
print("Text in rotated bottom right clip:", page.get_text("text", clip=clip_br))
clip_bl = fitz.Rect(0, 50, 100, 100)
print("Text in rotated bottom left clip:", page.get_text("text", clip=clip_bl))

# Let's test with cropbox
page.set_cropbox(fitz.Rect(0, 50, 100, 200))
print("Cropbox rotated rect:", page.rect)
# The visual cropbox makes it so the top 50 units are hidden.
# So "Hello Top Left" (y=20) is cut off.
clip_br2 = fitz.Rect(100, 0, 200, 100)
print("Text in cropped rotated bottom right:", page.get_text("text", clip=clip_br2))
