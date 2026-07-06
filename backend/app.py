"""DevTools — Flask app."""
import html
import json
import logging
import os
import threading
from pathlib import Path

from flask import Flask, Response, jsonify, send_from_directory
from flask_cors import CORS

from service import cache_store
from routes.wishes import wishes_bp

app = Flask(__name__, static_folder=None)
CORS(app)
logging.basicConfig(level=logging.INFO)

app.register_blueprint(wishes_bp)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
SITE_URL = "https://www.tools24.uk"
SUPPORTED_LANGS = {"zh", "en"}

TOOLS = {
    "json": {
        "zh": {
            "name": "JSON格式化校验工具",
            "title": "JSON格式化校验工具 - 在线 JSON Formatter / Viewer | Tools24",
            "description": "在线 JSON 格式化、压缩、校验和树形查看工具，支持快速检查 JSON 语法错误并复制格式化结果。",
            "keywords": "JSON格式化,JSON校验,JSON压缩,JSON Viewer,JSON Formatter,在线JSON工具",
            "intro": "粘贴 JSON 后即可格式化、压缩、校验语法并查看树形结构，适合接口调试、日志查看和配置文件整理。",
            "features": ["JSON 格式化与压缩", "语法错误提示", "树形层级查看", "本地浏览器处理，不上传数据"],
            "faq": [
                ("JSON 格式化会上传数据吗？", "不会，Tools24 的 JSON 工具在浏览器本地运行。"),
                ("支持 JSON 压缩吗？", "支持，可以把格式化 JSON 压缩成单行。"),
            ],
        },
        "en": {
            "name": "JSON Formatter and Validator",
            "title": "JSON Formatter and Validator Online | Tools24",
            "description": "Format, validate, compact and inspect JSON online with a tree viewer. Runs locally in your browser.",
            "keywords": "JSON formatter,JSON validator,JSON viewer,JSON compact,online JSON tool",
            "intro": "Paste JSON to format, compact, validate syntax and inspect nested data in a tree view for API debugging and config editing.",
            "features": ["Format and compact JSON", "Syntax validation", "Tree view", "Local browser processing"],
            "faq": [
                ("Is my JSON uploaded?", "No. The JSON tool runs in your browser."),
                ("Can it compact JSON?", "Yes. It can output a minified single-line JSON string."),
            ],
        },
    },
    "timestamp": {
        "zh": {
            "name": "时间戳转换工具",
            "title": "时间戳转换工具 - Unix Timestamp 在线转换 | Tools24",
            "description": "在线时间戳转换工具，支持秒/毫秒时间戳、日期时间、ISO 8601、UTC 和本地时间互转。",
            "keywords": "时间戳转换,Unix时间戳,毫秒时间戳,日期转换,ISO 8601,UTC时间",
            "intro": "输入任意常见时间格式，即可转换为秒级时间戳、毫秒时间戳、ISO、UTC、本地时间和相对时间。",
            "features": ["秒/毫秒时间戳互转", "ISO 8601 与 RFC 2822 输出", "UTC 和本地时间展示", "支持常见日期格式解析"],
            "faq": [
                ("秒时间戳和毫秒时间戳有什么区别？", "秒时间戳通常是 10 位，毫秒时间戳通常是 13 位。"),
                ("会根据本地时区转换吗？", "会，页面会显示当前浏览器所在时区。"),
            ],
        },
        "en": {
            "name": "Timestamp Converter",
            "title": "Timestamp Converter Online - Unix Time Converter | Tools24",
            "description": "Convert Unix timestamps, milliseconds, datetime, ISO 8601, UTC and local time online.",
            "keywords": "timestamp converter,Unix timestamp,milliseconds timestamp,ISO 8601,UTC time",
            "intro": "Convert common date strings into seconds, milliseconds, ISO, UTC, local time and relative time.",
            "features": ["Seconds and milliseconds", "ISO 8601 and RFC 2822 output", "UTC and local time", "Common date parsing"],
            "faq": [
                ("What is the difference between seconds and milliseconds?", "Second timestamps are usually 10 digits, while millisecond timestamps are usually 13 digits."),
                ("Does it use my local timezone?", "Yes. The page displays values based on your browser timezone."),
            ],
        },
    },
    "encoder": {
        "zh": {
            "name": "URL编码解码工具",
            "title": "URL编码解码工具 - URL Encode Decode 在线转换 | Tools24",
            "description": "在线 URL 编码和 URL 解码工具，支持中文、特殊字符、查询参数和链接文本快速转换。",
            "keywords": "URL编码,URL解码,URL Encode,URL Decode,百分号编码,网址编码",
            "intro": "输入文本或链接即可进行 URL Encode / Decode，适合处理查询参数、中文路径和特殊字符。",
            "features": ["URL 编码", "URL 解码", "自动识别编码内容", "一键复制结果"],
            "faq": [
                ("什么时候需要 URL 编码？", "当 URL 中包含中文、空格或特殊字符时通常需要编码。"),
                ("URL 解码失败怎么办？", "请确认输入内容是合法的百分号编码字符串。"),
            ],
        },
        "en": {
            "name": "URL Encoder and Decoder",
            "title": "URL Encoder and Decoder Online | Tools24",
            "description": "Encode and decode URLs, query parameters, Unicode text and special characters online.",
            "keywords": "URL encoder,URL decoder,URL encode,URL decode,percent encoding",
            "intro": "Encode or decode URLs and query strings for Unicode text, spaces and special characters.",
            "features": ["URL encode", "URL decode", "Auto detection", "Copy results"],
            "faq": [
                ("When should I URL encode text?", "Encode text when a URL contains spaces, Unicode or reserved characters."),
                ("Why does URL decoding fail?", "The input may not be a valid percent-encoded string."),
            ],
        },
    },
    "base64": {
        "zh": {
            "name": "Base64编码解码工具",
            "title": "Base64编码解码工具 - Base64 Encode Decode 在线转换 | Tools24",
            "description": "在线 Base64 编码解码工具，支持文本和文件转 Base64、Base64 还原下载文件。",
            "keywords": "Base64编码,Base64解码,Base64 Encode,Base64 Decode,文件转Base64",
            "intro": "支持文本 Base64 编码解码，也支持文件转 Base64 和 Base64 内容下载为文件。",
            "features": ["文本 Base64 编码", "文本 Base64 解码", "文件转 Base64", "Base64 还原文件"],
            "faq": [
                ("Base64 是加密吗？", "不是，Base64 是编码方式，不提供安全加密能力。"),
                ("支持文件转 Base64 吗？", "支持，可以在浏览器本地读取文件并生成 Base64。"),
            ],
        },
        "en": {
            "name": "Base64 Encoder and Decoder",
            "title": "Base64 Encoder and Decoder Online | Tools24",
            "description": "Encode and decode Base64 text online, convert files to Base64 and download decoded files.",
            "keywords": "Base64 encoder,Base64 decoder,Base64 encode,Base64 decode,file to Base64",
            "intro": "Encode or decode Base64 text, convert files to Base64 and restore decoded content as a download.",
            "features": ["Text Base64 encode", "Text Base64 decode", "File to Base64", "Decode Base64 to file"],
            "faq": [
                ("Is Base64 encryption?", "No. Base64 is an encoding format, not encryption."),
                ("Can it convert files to Base64?", "Yes. Files are read locally in your browser."),
            ],
        },
    },
    "diff": {
        "zh": {
            "name": "文本对比工具",
            "title": "文本对比工具 - 在线 Diff / 代码差异比较 | Tools24",
            "description": "在线文本对比和代码 Diff 工具，快速比较两段文本的新增、删除和相同内容。",
            "keywords": "文本对比,代码对比,Diff工具,在线Diff,文本差异比较",
            "intro": "粘贴原始文本和修改后文本，即可查看逐行新增、删除和未变化内容。",
            "features": ["逐行文本对比", "新增删除高亮", "左右文本交换", "适合代码和配置对比"],
            "faq": [
                ("支持代码对比吗？", "支持，可以对比代码、配置、日志或普通文本。"),
                ("文本会上传服务器吗？", "不会，对比在浏览器本地完成。"),
            ],
        },
        "en": {
            "name": "Text Diff Tool",
            "title": "Text Diff Tool Online - Compare Text and Code | Tools24",
            "description": "Compare two text snippets online and highlight added, removed and unchanged lines.",
            "keywords": "text diff,code diff,compare text online,diff tool,text comparison",
            "intro": "Paste original and modified text to compare line-by-line changes for code, configs and logs.",
            "features": ["Line-by-line diff", "Added and removed highlights", "Swap inputs", "Useful for code and config comparison"],
            "faq": [
                ("Can it compare code?", "Yes. It works for code, configs, logs and plain text."),
                ("Is my text uploaded?", "No. The comparison runs locally in your browser."),
            ],
        },
    },
    "markdown": {
        "zh": {
            "name": "Markdown 在线编辑预览工具",
            "title": "Markdown 在线编辑预览工具 - 实时预览/下载 HTML/DOC | Tools24",
            "description": "在线 Markdown 编辑器，支持实时预览、上传 .md 文件、下载为 HTML/DOC/Markdown 文件，全部在浏览器本地完成。",
            "keywords": "Markdown编辑器,Markdown预览,Markdown转HTML,在线Markdown,md文件",
            "intro": "左侧输入 Markdown，右侧实时预览渲染效果。支持上传 .md 文件，可下载为 HTML、DOC 或 Markdown 文件。",
            "features": ["实时 Markdown 预览", "上传 .md 文件编辑", "下载为 HTML / DOC / MD", "本地浏览器处理，不上传数据"],
            "faq": [
                ("Markdown 内容会上传吗？", "不会，所有编辑和渲染在浏览器本地完成。"),
                ("支持哪些导出格式？", "支持下载为 HTML 网页、DOC（Word 可打开）和原始 Markdown 文件。"),
            ],
        },
        "en": {
            "name": "Markdown Editor and Preview",
            "title": "Markdown Editor and Preview Online - Download HTML/DOC | Tools24",
            "description": "Online Markdown editor with live preview, .md file upload, download as HTML, DOC or Markdown file — all processed locally in your browser.",
            "keywords": "Markdown editor,Markdown preview,Markdown to HTML,online Markdown,md file",
            "intro": "Write Markdown on the left, see the rendered preview on the right. Upload .md files, download as HTML, DOC or Markdown.",
            "features": ["Live Markdown preview", "Upload .md files", "Download as HTML / DOC / MD", "Local browser processing"],
            "faq": [
                ("Is my Markdown uploaded?", "No. Editing and rendering happen locally in your browser."),
                ("What export formats are supported?", "Download as HTML, DOC (Word-compatible), or raw Markdown."),
            ],
        },
    },
    "fileinfo": {
        "zh": {
            "name": "文件详情和哈希校验工具",
            "title": "文件详情和 MD5/SHA 哈希校验工具 | Tools24",
            "description": "在线查看文件大小、类型、图片尺寸、音视频信息，并计算 MD5、SHA-1、SHA-256 和 Base64。",
            "keywords": "文件MD5,MD5校验,SHA256校验,文件哈希,文件信息,图片尺寸,Base64文件",
            "intro": "拖拽文件即可查看基础信息、媒体尺寸，并计算 MD5、SHA-1、SHA-256 和 Base64 预览。",
            "features": ["文件大小和类型识别", "MD5/SHA-1/SHA-256 计算", "图片和音视频信息", "文件内容本地处理"],
            "faq": [
                ("文件会上传吗？", "不会，文件信息和哈希计算在浏览器本地完成。"),
                ("支持哪些哈希？", "当前支持 MD5、SHA-1 和 SHA-256。"),
            ],
        },
        "en": {
            "name": "File Info and Hash Checker",
            "title": "File Info and MD5/SHA Hash Checker Online | Tools24",
            "description": "Inspect file size, type, media dimensions and calculate MD5, SHA-1, SHA-256 and Base64 locally.",
            "keywords": "file MD5,MD5 checker,SHA256 checker,file hash,file info,Base64 file",
            "intro": "Drop a file to inspect metadata, media dimensions and calculate MD5, SHA-1, SHA-256 and Base64 preview locally.",
            "features": ["File size and type", "MD5/SHA-1/SHA-256", "Image/audio/video info", "Local file processing"],
            "faq": [
                ("Is my file uploaded?", "No. Files are processed locally in your browser."),
                ("Which hashes are supported?", "MD5, SHA-1 and SHA-256 are supported."),
            ],
        },
    },
}

HOME_META = {
    "zh": {
        "name": "Tools24 在线开发者工具箱",
        "title": "Tools24 在线开发者工具箱 - JSON格式化、URL编码、Base64、时间戳转换",
        "description": "Tools24 提供在线 JSON 格式化校验、URL 编码解码、Base64 编码解码、时间戳转换、文本对比、文件 MD5/SHA 校验等开发者工具。",
        "keywords": "在线工具,开发者工具,JSON格式化,URL编码,Base64编码,时间戳转换,文本对比,MD5校验",
        "intro": "Tools24 是面向开发者和日常办公的在线工具箱，提供 JSON、URL、Base64、时间戳、文本对比和文件哈希等常用工具。",
    },
    "en": {
        "name": "Tools24 Online Developer Toolbox",
        "title": "Tools24 Online Developer Toolbox - JSON, URL Encoder, Base64, Timestamp",
        "description": "Tools24 provides online developer tools for JSON formatting, URL encoding, Base64, timestamp conversion, text diff and file hash checking.",
        "keywords": "online tools,developer tools,JSON formatter,URL encoder,Base64,timestamp converter,text diff,MD5 checker",
        "intro": "Tools24 is an online toolbox for developers, covering JSON, URL encoding, Base64, timestamp conversion, text diff and file hashing.",
    },
}


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/robots.txt")
def robots():
    return Response(
        f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n",
        mimetype="text/plain",
    )


@app.route("/sitemap.xml")
def sitemap():
    urls = []
    for lang in ("zh", "en"):
        urls.append((f"{SITE_URL}/{lang}/", "daily", "1.0"))
        for tool_id in TOOLS:
            urls.append((f"{SITE_URL}/{lang}/tool/{tool_id}", "weekly", "0.8"))
    body = "\n".join(
        f"  <url><loc>{loc}</loc><changefreq>{freq}</changefreq><priority>{priority}</priority></url>"
        for loc, freq, priority in urls
    )
    xml = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n'
    return Response(xml, mimetype="application/xml")


@app.route("/")
def index():
    return render_spa("zh", None)


# 语言前缀路由：/zh/、/zh/tool/json 等 → 始终返回 index.html（SPA 客户端路由）
@app.route("/<lang>")
@app.route("/<lang>/")
def index_lang(lang):
    if lang not in SUPPORTED_LANGS:
        return send_from_directory(str(FRONTEND_DIR), "index.html")
    return render_spa(lang, None)


@app.route("/<lang>/tool/<tool_id>")
def tool_lang(lang, tool_id):
    if lang not in SUPPORTED_LANGS or tool_id not in TOOLS:
        return send_from_directory(str(FRONTEND_DIR), "index.html")
    return render_spa(lang, tool_id)


@app.route("/<path:filename>")
def frontend_files(filename):
    return send_from_directory(str(FRONTEND_DIR), filename)


def render_spa(lang, tool_id):
    template = (FRONTEND_DIR / "index.html").read_text(encoding="utf-8")
    meta = TOOLS[tool_id][lang] if tool_id else HOME_META[lang]
    path = f"/{lang}/tool/{tool_id}" if tool_id else f"/{lang}/"
    canonical = f"{SITE_URL}{path}"
    paired_path = f"/tool/{tool_id}" if tool_id else "/"
    replacements = {
        "<!--SEO_HTML_LANG-->": "zh-CN" if lang == "zh" else "en",
        "<!--SEO_TITLE-->": html.escape(meta["title"], quote=True),
        "<!--SEO_DESCRIPTION-->": html.escape(meta["description"], quote=True),
        "<!--SEO_KEYWORDS-->": html.escape(meta["keywords"], quote=True),
        "<!--SEO_CANONICAL-->": canonical,
        "<!--SEO_HREFLANG_ZH-->": f"{SITE_URL}/zh{paired_path}",
        "<!--SEO_HREFLANG_EN-->": f"{SITE_URL}/en{paired_path}",
        "<!--SEO_HREFLANG_DEFAULT-->": f"{SITE_URL}/zh{paired_path}",
        "<!--SEO_SCHEMA-->": html.escape(json.dumps(build_schema(lang, tool_id, canonical, meta), ensure_ascii=False), quote=False),
        "<!--SEO_CONTENT-->": build_seo_content(lang, tool_id, meta),
    }
    for marker, value in replacements.items():
        template = template.replace(marker, value)
    return Response(template, mimetype="text/html")


def build_schema(lang, tool_id, canonical, meta):
    schema = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": meta["name"],
        "url": canonical,
        "description": meta["description"],
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "Any",
        "inLanguage": "zh-CN" if lang == "zh" else "en",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
    }
    if tool_id:
        schema["mainEntity"] = {
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": question,
                    "acceptedAnswer": {"@type": "Answer", "text": answer},
                }
                for question, answer in TOOLS[tool_id][lang]["faq"]
            ],
        }
    return schema


def build_seo_content(lang, tool_id, meta):
    nav = "".join(
        f'<li><a href="/{lang}/tool/{tool_id_item}">{html.escape(TOOLS[tool_id_item][lang]["name"])}</a></li>'
        for tool_id_item in TOOLS
    )
    if not tool_id:
        heading = html.escape(meta["name"])
        intro = html.escape(meta["intro"])
        return (
            '<section class="seo-content">'
            f"<h1>{heading}</h1><p>{intro}</p>"
            f"<h2>{'常用在线工具' if lang == 'zh' else 'Online Developer Tools'}</h2><ul>{nav}</ul>"
            f"<p>{'所有工具均可免费使用，常见文本与文件处理在浏览器本地完成。' if lang == 'zh' else 'All tools are free to use, and common text or file operations run locally in your browser.'}</p>"
            "</section>"
        )

    features = "".join(f"<li>{html.escape(feature)}</li>" for feature in meta["features"])
    faq = "".join(
        f"<h3>{html.escape(question)}</h3><p>{html.escape(answer)}</p>"
        for question, answer in meta["faq"]
    )
    return (
        '<section class="seo-content">'
        f"<h1>{html.escape(meta['name'])}</h1><p>{html.escape(meta['intro'])}</p>"
        f"<h2>{'功能特点' if lang == 'zh' else 'Features'}</h2><ul>{features}</ul>"
        f"<h2>{'常见问题' if lang == 'zh' else 'FAQ'}</h2>{faq}"
        f"<h2>{'更多工具' if lang == 'zh' else 'More tools'}</h2><ul>{nav}</ul>"
        "</section>"
    )


# --- Visit counter (Redis preferred, file fallback) ---
_VISIT_KEY = "visit_count"
_COUNTER_PATH = Path("/tmp/visit_count.json") if Path("/tmp").exists() else Path(__file__).resolve().parent / "config" / "visit_count.json"
_counter_lock = threading.Lock()


def _read_counter():
    try:
        if _COUNTER_PATH.exists():
            return json.loads(_COUNTER_PATH.read_text()).get("count", 0)
    except Exception:
        pass
    return 0


def _write_counter(count):
    _COUNTER_PATH.parent.mkdir(parents=True, exist_ok=True)
    _COUNTER_PATH.write_text(json.dumps({"count": count}))


@app.route("/api/visits")
def visits():
    # Shared Redis path — atomic, correct across instances.
    if cache_store.is_enabled():
        count = cache_store.cache_incr(_VISIT_KEY)
        if count is not None:
            return jsonify({"count": count})
        # Redis transiently unavailable — fall through to the file counter.
    with _counter_lock:
        count = _read_counter() + 1
        _write_counter(count)
    return jsonify({"count": count})


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8731"))
    debug = os.getenv("FLASK_DEBUG", "").lower() in ("1", "true", "yes", "on")
    app.run(host=host, port=port, debug=debug)
