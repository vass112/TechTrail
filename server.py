import json
import os
import http.server
import socketserver
from urllib.parse import urlparse, parse_qs

PORT = 8000
DATABASE_FILE = "database.json"
DIRECTORY = "."

# Default database structure
DEFAULT_DB = {
    "teams": {},
    "clues": {
        "CLUE1": "Go where books are kept in silence",
        "CLUE2": "Find the building where machines are designed",
        "CLUE3": "Look near the tallest flag on campus"
    }
}

def load_db():
    if not os.path.exists(DATABASE_FILE):
        save_db(DEFAULT_DB)
        return DEFAULT_DB
    with open(DATABASE_FILE, 'r') as f:
        data = json.load(f)
        # Migrate teams to lowercase keys if they aren't already
        new_teams = {k.lower(): v for k, v in data.get("teams", {}).items()}
        data["teams"] = new_teams
        return data

def save_db(data):
    with open(DATABASE_FILE, 'w') as f:
        json.dump(data, f, indent=4)

class TechTrailHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/leaderboard':
            db = load_db()
            leaderboard = [
                {"team": name, "score": len(team_data.get("solved", []))}
                for name, team_data in db["teams"].items()
            ]
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(leaderboard).encode())
            return
            
        elif parsed_path.path == '/api/clues':
            db = load_db()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(db["clues"]).encode())
            return
            
        # Fall back to serving static files for the frontend PWA
        return super().do_GET()

    def do_POST(self):
        parsed_path = urlparse(self.path)
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            req = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_error(400, "Bad Request: Invalid JSON")
            return

        db = load_db()

        if parsed_path.path == '/api/login':
            team = req.get('team', '').lower()
            password = req.get('password')
            
            # Special Admin check
            if team == "admin" and password == "ananthan":
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "isAdmin": True}).encode())
                return

            if team in db["teams"] and db["teams"][team]["password"] == password:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "isAdmin": False, "solved": db["teams"][team].get("solved", [])}).encode())
            else:
                self.send_response(401)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "Invalid credentials"}).encode())
            return

        elif parsed_path.path == '/api/progress':
            team = req.get('team', '').lower()
            clue_id = req.get('clue_id')
            
            if team in db["teams"]:
                solved = db["teams"][team].setdefault("solved", [])
                if clue_id not in solved:
                    solved.append(clue_id)
                    save_db(db)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "solved": solved}).encode())
            else:
                self.send_error(404, "Team not found")
            return

        elif parsed_path.path == '/api/admin/teams':
            team = req.get('team', '').lower()
            password = req.get('password')
            
            if team and password:
                db["teams"][team] = {"password": password, "solved": []}
                save_db(db)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode())
            else:
                self.send_error(400, "Missing team or password")
            return

        elif parsed_path.path == '/api/admin/delete_team':
            team = req.get('team', '').lower()
            if team in db["teams"]:
                del db["teams"][team]
                save_db(db)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode())
            else:
                self.send_error(404, "Team not found")
            return
            
        elif parsed_path.path == '/api/admin/clues':
            clues = req.get('clues')
            if isinstance(clues, dict):
                db["clues"] = clues
                save_db(db)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode())
            else:
                self.send_error(400, "Invalid clues format")
            return

        elif parsed_path.path == '/api/admin/reset_progress':
            for team in db["teams"]:
                db["teams"][team]["solved"] = []
            save_db(db)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode())
            return

        self.send_error(404, "File not found")

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), TechTrailHandler) as httpd:
    print(f"TechTrail API Server running at port {PORT}")
    httpd.serve_forever()
