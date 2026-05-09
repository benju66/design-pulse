import fitz
import urllib.request
import json
import io
import email.generator
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication

# 1. Create a dummy PDF with a simple line using PyMuPDF (fitz)
doc = fitz.open()
page = doc.new_page(width=500, height=500)
# Draw a rectangle so the extraction engine finds some lines
page.draw_rect(fitz.Rect(100, 100, 400, 400), color=(1, 0, 0), width=2)
pdf_bytes = doc.write()
doc.close()

# Save the dummy pdf so the user has it if they want to test manually
with open('dummy.pdf', 'wb') as f:
    f.write(pdf_bytes)

# 2. Build a multipart/form-data request using built-in libraries
msg = MIMEMultipart('form-data')
part = MIMEApplication(pdf_bytes, 'pdf')
part.add_header('Content-Disposition', 'form-data; name="file"; filename="dummy.pdf"')
msg.attach(part)

# Get the generated boundary
boundary = msg.get_boundary()
content_type = f'multipart/form-data; boundary={boundary}'

# Extract the body payload
fp = io.BytesIO()
g = email.generator.BytesGenerator(fp, mangle_from_=False)
g.flatten(msg)
body = fp.getvalue()
# email generator adds headers to the output; we only want the body.
body = body.split(b'\n\n', 1)[1]

req = urllib.request.Request('http://127.0.0.1:8000/extract-vectors', data=body, headers={'Content-Type': content_type}, method='POST')

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        print('SUCCESS!')
        print('Status Code:', response.status)
        print('Response Data:')
        print(json.dumps(result, indent=2))
except urllib.error.HTTPError as e:
    print('HTTP Error:', e.code)
    print('Response:', e.read().decode('utf-8'))
except Exception as e:
    print('Error:', e)
