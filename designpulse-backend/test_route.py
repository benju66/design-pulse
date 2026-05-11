import urllib.request

url = "http://127.0.0.1:8000/drawings/extract/123/456"
req = urllib.request.Request(url, method="OPTIONS")
req.add_header("Origin", "http://localhost:3000")
req.add_header("Access-Control-Request-Method", "POST")
try:
    resp = urllib.request.urlopen(req)
    print("OPTIONS status:", resp.status)
    print("OPTIONS headers:", resp.headers)
except Exception as e:
    print("OPTIONS Error:", e)
