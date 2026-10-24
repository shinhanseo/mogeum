"""Expose only the isolated local project's public config to native probes; never a service key."""
import json
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer

status = json.loads(subprocess.check_output(["node_modules/.bin/supabase", "status", "-o", "json"], stderr=subprocess.DEVNULL))
if status.get("API_URL") != "http://127.0.0.1:54321":
    raise SystemExit("Expected isolated local Supabase on port 54321")
payload = json.dumps({"url": status["API_URL"], "publicKey": status["ANON_KEY"]}).encode()

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/config" or self.headers.get("Origin"):
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_args):
        pass

print("Native probe public configuration: loopback port 8766", flush=True)
HTTPServer(("127.0.0.1", 8766), Handler).serve_forever()
