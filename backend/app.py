"""DevTools — minimal Flask app shell."""
import logging
import os
from pathlib import Path

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder=None)
CORS(app)
logging.basicConfig(level=logging.INFO)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/")
def index():
    return send_from_directory(str(FRONTEND_DIR), "index.html")


# 语言前缀路由：/zh/、/zh/tool/json 等 → 始终返回 index.html（SPA 客户端路由）
@app.route("/<lang>")
@app.route("/<lang>/")
def index_lang(lang):
    return send_from_directory(str(FRONTEND_DIR), "index.html")


@app.route("/<lang>/tool/<tool_id>")
def tool_lang(lang, tool_id):
    return send_from_directory(str(FRONTEND_DIR), "index.html")


@app.route("/<path:filename>")
def frontend_files(filename):
    return send_from_directory(str(FRONTEND_DIR), filename)


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8730"))
    debug = os.getenv("FLASK_DEBUG", "").lower() in ("1", "true", "yes", "on")
    app.run(host=host, port=port, debug=debug)
