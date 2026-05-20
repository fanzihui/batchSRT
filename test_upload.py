import requests
import re

# 1. Fetch token
session = requests.Session()
url = "https://www.text-to-speech.cn/stt.html"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}
response = session.get(url, headers=headers)
html = response.text
token = re.search(r'token[\"\'\s:=]+([a-fA-F0-9]{32})', html).group(1)
print("Fetched token:", token)

# 2. Use token
url_upload = "https://www.text-to-speech.cn/getSrt.php"
payload = {'type': 'stt', 'token': token}
files = [
  ('video', ('test.mp3', b'dummy audio content', 'audio/mpeg'))
]
headers_upload = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://www.text-to-speech.cn',
    'Referer': 'https://www.text-to-speech.cn/stt.html'
}
res = session.post(url_upload, headers=headers_upload, data=payload, files=files)
print(res.text)
