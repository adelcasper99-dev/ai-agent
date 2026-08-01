import os, requests
key = ""
with open(".env") as f:
    for line in f:
        if line.startswith("GEMINI_API_KEY"):
            key = line.split("=")[1].strip().strip("'\"")

r = requests.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={key}")
models = r.json().get("models", [])
for m in models:
    if "flash" in m["name"]:
        print(m["name"])
