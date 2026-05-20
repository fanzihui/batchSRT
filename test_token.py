import requests
import re

url = "https://www.text-to-speech.cn/stt.html"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

response = requests.get(url, headers=headers)
html = response.text

# Try to find token in the html
# e.g., var token = "xxx" or data-token="xxx"
token_matches = re.findall(r'token[\"\'\s:=]+([a-fA-F0-9]{32})', html)
print("Tokens found in HTML:", token_matches)

# Let's also check if there is a specific token variable in the script
js_matches = re.findall(r'\"token\"[,\s:]+[\"\']([a-fA-F0-9]{32})[\"\']', html)
print("Tokens in JS:", js_matches)

with open("page.html", "w", encoding="utf-8") as f:
    f.write(html)
