import fitz

doc = fitz.open()
page = doc.new_page(width=100, height=200)

page.insert_text(fitz.Point(80, 180), "Target", fontsize=10)
page.set_rotation(90)

# Visually, the point (80, 180) on a 100x200 portrait page,
# when rotated 90 degrees clockwise, becomes:
# New width = 200, New height = 100
# The point (80, 180) moves to the bottom-left quadrant physically.
# If I draw a box on the rotated image around where "Target" visually is,
# the visual bounding box on the 200x100 image would be:
# x' = 200 - 180 = 20
# y' = 80
# So a visual box near (10, 70, 40, 90) on the ROTATED image.

visual_clip = fitz.Rect(10, 70, 40, 90)

# De-rotate the clip to match the unrotated text extraction space
unrotated_clip = visual_clip * page.derotation_matrix

print("Visual clip:", visual_clip)
print("Unrotated clip:", unrotated_clip)
print("Extracted text:", page.get_text("text", clip=unrotated_clip))

