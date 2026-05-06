"""
app.py — Entry point aplikasi Flask PGE Lahendong.
Semua route didaftarkan via Blueprint.
"""
from flask import Flask
import os

from routes.auth   import auth_bp
from routes.pages  import pages_bp
from routes.upload import upload_bp
from routes.api    import api_bp
from routes.export import export_bp

app = Flask(__name__)
app.secret_key = "pge_lahendong_2026"
app.config["PERMANENT_SESSION_LIFETIME"] = 3600

# Pastikan folder uploads ada
os.makedirs("uploads", exist_ok=True)

# Daftarkan semua blueprint
app.register_blueprint(auth_bp)
app.register_blueprint(pages_bp)
app.register_blueprint(upload_bp)
app.register_blueprint(api_bp)
app.register_blueprint(export_bp)


if __name__ == "__main__":
    print("🔥 Flask jalan di http://127.0.0.1:5000")
    app.run(debug=True, host="127.0.0.1", port=5000)
