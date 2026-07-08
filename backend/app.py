"""DevTools — Flask app."""
import hmac
import html
import json
import logging
import os
import threading
from pathlib import Path

import requests
from flask import Flask, Response, jsonify, request, send_from_directory
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
            "features": ["JSON 格式化与压缩", "语法错误提示", "树形层级查看", "JSON 转换为 YAML/XML/CSV/JS/Kotlin/Java/Go", "本地浏览器处理，不上传数据"],
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
            "features": ["Format and compact JSON", "Syntax validation", "Tree view", "Convert JSON to YAML/XML/CSV/JS/Kotlin/Java/Go", "Local browser processing"],
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
            "name": "在线编码转换工具",
            "title": "在线编码转换工具 - URL编码 Base64 Base32 Base16 Unicode UTF-8 | Tools24",
            "description": "在线多类型编码转换工具，支持 URL编解码、Base64、Base32、Base16、Unicode转义、UTF-8字节、ASCII 七类互转。",
            "keywords": "URL编码,Base64,Base32,Base16,Unicode转义,UTF-8编码,ASCII转义,编码转换,字符编码",
            "intro": "选择编码类型，一键完成 URL、Base64、Base32、Base16、Unicode 转义、UTF-8 字节和 ASCII 之间的相互转换。",
            "features": ["URL 编解码", "Base64 / Base32 / Base16", "Unicode 转义 ↔ 文本", "UTF-8 字节 ↔ 文本", "ASCII 转义", "自动识别输入类型"],
            "faq": [
                ("支持哪些编码类型？", "支持 URL百分号编码、Base64、Base32、Base16、Unicode转义序列、UTF-8十六进制字节和 ASCII 编码。"),
                ("编码内容会上传服务器吗？", "不会，所有转换在浏览器本地完成。"),
            ],
        },
        "en": {
            "name": "Online Encoding Converter",
            "title": "Online Encoding Converter - URL Base64 Base32 Base16 Unicode UTF-8 | Tools24",
            "description": "Online multi-format encoding converter: URL encode/decode, Base64, Base32, Base16, Unicode escapes, UTF-8 hex bytes, and ASCII.",
            "keywords": "URL encoder,Base64,Base32,Base16,Unicode escape,UTF-8 hex,ASCII escape,encoding converter",
            "intro": "Choose an encoding type and convert between URL, Base64, Base32, Base16, Unicode escapes, UTF-8 hex bytes and ASCII.",
            "features": ["URL encode/decode", "Base64 / Base32 / Base16", "Unicode escapes ↔ text", "UTF-8 bytes ↔ text", "ASCII escaping", "Auto-detect input type"],
            "faq": [
                ("What encoding types are supported?", "URL percent-encoding, Base64, Base32, Base16, Unicode escape sequences, UTF-8 hex bytes, and ASCII encoding."),
                ("Is my data uploaded?", "No. All conversion happens locally in your browser."),
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
    "android": {
        "zh": {
            "name": "Android 常用速查工具",
            "title": "Android 常用速查 - API ADB 权限 Intent Gradle 对照 | Tools24",
            "description": "Android 开发者常用速查：系统版本与 API Level、ADB 命令、透明度、dp/px、权限、Intent、Manifest 配置、资源限定符、生命周期和官方文档地址。",
            "keywords": "Android,API Level,安卓版本,ADB,权限,Intent,Manifest,资源限定符,Android文档,dp转px,屏幕密度,开发者工具",
            "intro": "Android 开发常用信息查询：API 版本、ADB 命令、透明度 Hex、dp/px、权限、Intent、Manifest、资源限定符、生命周期、Gradle 与官方文档地址。",
            "features": ["Android 版本 ↔ API Level 对照", "ADB 常用命令速查", "权限 / Intent / Manifest 配置查询", "资源限定符与生命周期对照", "Android 官方常用文档地址"],
            "faq": [
                ("Android API Level 最新是什么？", "截至 2026 年，Android 17 (Cinnamon Bun) 对应 API 37。"),
                ("dp 和 px 如何转换？", "px = dp × density。例如 mdpi (1x) 下 1dp = 1px，xxhdpi (3x) 下 1dp = 3px。"),
            ],
        },
        "en": {
            "name": "Android Quick Reference",
            "title": "Android Quick Reference - API ADB Permissions Intent Gradle | Tools24",
            "description": "Android developer quick reference: API levels, ADB commands, alpha values, dp/px, permissions, intents, Manifest config, resource qualifiers, lifecycle and official docs.",
            "keywords": "Android,API level,ADB,permissions,Intent,Manifest,resource qualifiers,Android docs,dp to px,screen density,developer tools",
            "intro": "Quick reference for Android developers: API levels, ADB commands, alpha hex values, dp/px, permissions, intents, Manifest, resource qualifiers, lifecycle, Gradle and official docs.",
            "features": ["Android version ↔ API level", "Common ADB commands", "Permissions / Intents / Manifest config", "Resource qualifiers and lifecycle", "Official Android docs links"],
            "faq": [
                ("What is the latest Android API level?", "As of 2026, Android 17 (Cinnamon Bun) corresponds to API 37."),
                ("How to convert dp to px?", "px = dp × density. For example, mdpi (1x): 1dp = 1px; xxhdpi (3x): 1dp = 3px."),
            ],
        },
    },
    "crypto": {
        "zh": {
            "name": "在线加解密工具",
            "title": "在线加解密工具 - AES RSA 对称非对称加密 | Tools24",
            "description": "在线加解密工具，支持 AES-GCM/CBC 对称加密和 RSA-OAEP 非对称加密，基于浏览器 Web Crypto API 本地处理，数据不上传。",
            "keywords": "AES加密,RSA加密,对称加密,非对称加密,在线加解密,Web Crypto,密钥生成",
            "intro": "支持对称加密（AES-GCM/CBC 密码派生）和非对称加密（RSA-OAEP 密钥对），所有操作在浏览器本地完成。",
            "features": ["AES-GCM / AES-CBC 对称加密", "PBKDF2 密码派生密钥", "RSA-OAEP 密钥对生成（2048/4096）", "PEM 格式密钥导出", "浏览器本地处理，数据不上传"],
            "faq": [
                ("加密数据会上传服务器吗？", "不会，加解密完全在浏览器本地使用 Web Crypto API 完成，密钥和明文不会离开本地。"),
                ("支持哪些加密算法？", "对称加密支持 AES-GCM 和 AES-CBC，非对称加密支持 RSA-OAEP，密钥长度可选 128/192/256 或 2048/4096 位。"),
            ],
        },
        "en": {
            "name": "Online Encryption Tool",
            "title": "Online Encryption Tool - AES RSA Symmetric Asymmetric | Tools24",
            "description": "Online encryption tool with AES-GCM/CBC symmetric and RSA-OAEP asymmetric encryption, powered by browser Web Crypto API — no data leaves your device.",
            "keywords": "AES encryption,RSA encryption,symmetric encryption,asymmetric encryption,online encryption,Web Crypto,key generation",
            "intro": "Symmetric encryption (AES-GCM/CBC with PBKDF2) and asymmetric encryption (RSA-OAEP with key pairs), all processed locally in your browser.",
            "features": ["AES-GCM / AES-CBC symmetric", "PBKDF2 key derivation", "RSA-OAEP key pair (2048/4096)", "PEM key export", "Local browser processing"],
            "faq": [
                ("Is my data sent to a server?", "No. All encryption/decryption uses the browser Web Crypto API locally. Keys and plaintext never leave your device."),
                ("Which algorithms are supported?", "Symmetric: AES-GCM and AES-CBC. Asymmetric: RSA-OAEP. Key lengths: 128/192/256 bit (AES) and 2048/4096 bit (RSA)."),
            ],
        },
    },
    "curl": {
        "zh": {
            "name": "在线 Curl 命令工具",
            "title": "在线 Curl 命令构建转换工具 - Curl Builder Converter | Tools24",
            "description": "在线 Curl 工具集：可视化构建 curl 命令、常用 curl 示例速查、curl 命令转 Python/JavaScript/Go/Java 代码。",
            "keywords": "curl命令,curl构建器,curl转代码,HTTP调试,API测试,curl示例",
            "intro": "可视化构建 curl 命令、浏览常用示例、一键转换为 Python/JS/Go/Java 代码，适合 API 调试和开发。",
            "features": ["可视化构建 curl 命令", "24 个常用 curl 示例速查", "curl → Python/JS/Go/Java 代码转换", "点击示例自动填充命令"],
            "faq": [
                ("curl 命令支持哪些转换语言？", "支持转换为 Python (requests)、JavaScript (fetch)、Go (net/http) 和 Java (OkHttp)。"),
                ("生成的 curl 命令可以直接运行吗？", "可以，复制后在终端粘贴即可运行。"),
            ],
        },
        "en": {
            "name": "Online Curl Command Tool",
            "title": "Online Curl Command Builder and Converter | Tools24",
            "description": "Online curl tool: visual command builder, common curl examples, and curl-to-code converter for Python/JavaScript/Go/Java.",
            "keywords": "curl command,curl builder,curl to code,HTTP debugging,API testing,curl examples",
            "intro": "Visually build curl commands, browse common patterns, and convert curl to Python/JS/Go/Java code for API development.",
            "features": ["Visual curl command builder", "24 common curl examples", "curl → Python/JS/Go/Java converter", "Click examples to autofill command"],
            "faq": [
                ("Which languages can curl be converted to?", "Python (requests), JavaScript (fetch), Go (net/http), and Java (OkHttp)."),
                ("Can I run the generated curl command?", "Yes, copy and paste into your terminal."),
            ],
        },
    },
    "qrcode": {
        "zh": {
            "name": "在线二维码生成解析工具",
            "title": "在线二维码生成解析工具 - QR Code Generator Parser | Tools24",
            "description": "在线二维码生成和解析工具，输入文本生成二维码图片下载，上传图片解析二维码内容，全部在浏览器本地完成。",
            "keywords": "二维码生成,二维码解析,QR Code,在线二维码,QR生成器",
            "intro": "输入文本或链接，自动生成可下载的二维码图片；上传或粘贴二维码图片即可解析内容。",
            "features": ["文本/链接生成二维码", "可调尺寸，PNG 下载", "图片上传/粘贴解析二维码", "浏览器本地处理，数据不上传"],
            "faq": [
                ("二维码内容会上传服务器吗？", "不会，生成和解析完全在浏览器本地完成。"),
                ("支持哪些输入类型？", "生成支持任意文本、URL、电话号码等；解析支持主流图片格式。"),
            ],
        },
        "en": {
            "name": "Online QR Code Generator and Parser",
            "title": "Online QR Code Generator and Parser | Tools24",
            "description": "Generate QR codes from text and parse QR codes from images — all processed locally in your browser.",
            "keywords": "QR code generator,QR code parser,online QR code,QR reader,QR creator",
            "intro": "Enter text to generate downloadable QR codes; upload or paste QR code images to decode their content.",
            "features": ["Text/URL to QR code", "Adjustable size, PNG download", "Image upload/paste parsing", "Local browser processing"],
            "faq": [
                ("Is my QR code data uploaded?", "No. Generation and parsing are done locally in your browser."),
                ("What formats are supported?", "Any text, URL, phone, etc. for generation; common image formats for parsing."),
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
    "terminal": {
        "zh": {
            "name": "终端常用命令速查",
            "title": "终端常用命令速查表 - Shell 命令参考 Linux 运维 | Tools24",
            "description": "终端常用命令速查表，覆盖文件操作、文本处理、进程管理、网络工具、系统信息、权限管理、压缩归档和 Shell 技巧，面向运维人员和终端用户。",
            "keywords": "终端命令,shell命令,Linux命令,运维命令,命令行速查,macOS命令,bash,zsh,终端常用命令",
            "intro": "面向运维人员和终端用户的常用 Shell 命令速查表，按类别分为文件操作、文本处理、进程管理、网络、系统、权限、压缩归档和 Shell 技巧八大类。",
            "features": ["文件操作命令", "文本处理命令", "进程管理命令", "网络工具命令", "系统信息命令", "权限管理命令", "压缩归档命令", "Shell 技巧"],
            "faq": [
                ("这些命令适用于哪些系统？", "大部分命令适用于 Linux 和 macOS，部分命令（如 apt）仅限特定发行版。"),
                ("如何查找特定命令？", "点击对应分类标签后使用搜索框，支持中英文关键词过滤。"),
            ],
        },
        "en": {
            "name": "Terminal Commands",
            "title": "Terminal Commands Cheat Sheet - Shell Reference Linux Ops | Tools24",
            "description": "Terminal commands quick reference covering file ops, text processing, process management, networking, system info, permissions, archives and shell tips for ops and terminal users.",
            "keywords": "terminal commands,shell commands,linux commands,ops commands,cli reference,bash,zsh,terminal cheat sheet",
            "intro": "A quick reference of common shell commands for ops and terminal users, organized into eight categories: file ops, text processing, process management, networking, system info, permissions, archives and shell tips.",
            "features": ["File operations", "Text processing", "Process management", "Network tools", "System info", "Permissions", "Archives", "Shell tips"],
            "faq": [
                ("Which systems do these commands apply to?", "Most commands work on Linux and macOS. Some (like apt) are distro-specific."),
                ("How do I find a specific command?", "Click a category tab then use the search box. Supports keyword filtering in both English and Chinese."),
            ],
        },
    },
    "ai": {
        "zh": {
            "name": "AI 常用指令速查",
            "title": "AI 常用指令速查 - Claude Code Codex Copilot CLI 参考 | Tools24",
            "description": "AI 编程助手 CLI 常用指令速查，覆盖 Claude Code、Codex、GitHub Copilot CLI、Cursor、aider 和 Windsurf 的命令参数和用法。",
            "keywords": "AI CLI,Claude Code,Codex,GitHub Copilot,Cursor,aider,Windsurf,AI编程助手,终端指令",
            "intro": "面向开发者的 AI 编程助手 CLI 常用指令速查，按工具分类为 Claude Code、Codex、GitHub Copilot CLI、Cursor、aider 和 Windsurf 六个标签页。",
            "features": ["Claude Code 指令", "Codex (OpenAI) 指令", "GitHub Copilot CLI 指令", "Cursor CLI 指令", "aider 指令", "Windsurf / Cascade 指令"],
            "faq": [
                ("这些 AI 工具都是免费的吗？", "Claude Code 和 Codex 需要各自的 API key 按量付费；GitHub Copilot 需订阅；aider 开源免费但需自带 LLM API key。"),
                ("哪个 AI 工具最适合我？", "Claude Code 综合能力强；Codex 沙箱安全；Copilot CLI 适合命令行补全；aider 适合喜欢终端+Git 工作流的开发者。"),
            ],
        },
        "en": {
            "name": "AI CLI Commands",
            "title": "AI CLI Commands Reference - Claude Code Codex Copilot | Tools24",
            "description": "AI coding assistant CLI commands reference covering Claude Code, Codex, GitHub Copilot CLI, Cursor, aider and Windsurf — commands, flags and usage patterns.",
            "keywords": "AI CLI,Claude Code,Codex,GitHub Copilot CLI,Cursor,aider,Windsurf,AI coding assistant,terminal commands",
            "intro": "A quick reference of AI coding assistant CLI commands for developers, organized into six tabs: Claude Code, Codex, GitHub Copilot CLI, Cursor, aider and Windsurf.",
            "features": ["Claude Code commands", "Codex (OpenAI) commands", "GitHub Copilot CLI commands", "Cursor CLI commands", "aider commands", "Windsurf / Cascade commands"],
            "faq": [
                ("Are these AI tools free?", "Claude Code and Codex require API keys with pay-per-use pricing. GitHub Copilot requires a subscription. aider is open-source and free but you need your own LLM API key."),
                ("Which AI tool should I choose?", "Claude Code is the most capable all-rounder. Codex offers sandbox safety. Copilot CLI excels at shell completions. aider suits developers who prefer terminal+Git workflows."),
            ],
        },
    },
    "translate": {
        "zh": {
            "name": "在线翻译工具",
            "title": "在线翻译工具 - 中英互译 单词音标 DeepSeek | Tools24",
            "description": "基于 DeepSeek 的智能翻译工具，自动检测中英文方向，短词显示 IPA 音标和词性标注，长文段落纯翻译，离开输入框自动触发。",
            "keywords": "在线翻译,中英翻译,单词音标,DeepSeek翻译,自动翻译,翻译工具",
            "intro": "输入任意文字即可智能翻译：中文自动译英文，其他语言自动译中文。短词附带 IPA 音标发音和词性，长文专注流畅翻译。离开输入框或停止输入 0.8 秒后自动翻译。",
            "features": ["中英文自动检测方向", "短词 IPA 音标 + 词性标注", "长文流畅翻译", "离开输入框自动翻译", "翻译历史记录"],
            "faq": [
                ("翻译引擎是什么？", "基于 DeepSeek Chat API，提供高质量中英互译。"),
                ("短词和长文有什么区别？", "≤5 个词的短文本会额外显示国际音标（IPA）、发音提示和词性；长文本仅输出流畅译文。"),
            ],
        },
        "en": {
            "name": "Online Translator",
            "title": "Online Translator - CN/EN with Phonetics DeepSeek | Tools24",
            "description": "DeepSeek-powered smart translator with auto language detection, IPA phonetics and POS tagging for words, pure translation for paragraphs. Translates on blur.",
            "keywords": "online translator,Chinese English translation,phonetics,DeepSeek translator,auto translate,IPA pronunciation",
            "intro": "Type anything to translate: Chinese → English or any language → Chinese. Short words get IPA phonetics and part-of-speech tags. Long text gets clean, fluent translation. Translates automatically when you leave the input or pause typing for 0.8s.",
            "features": ["Auto language detection", "IPA phonetics + POS for words", "Fluent long-text translation", "Translate on blur", "Translation history"],
            "faq": [
                ("What engine is used?", "DeepSeek Chat API, providing high-quality Chinese-English translation."),
                ("What's the difference for short vs long text?", "Short text (≤5 words) gets IPA pronunciation and POS tagging. Long text gets pure fluent translation."),
            ],
        },
    },
}

HOME_META = {
    "zh": {
        "name": "Tools24 在线开发者工具箱",
        "title": "Tools24 在线开发者工具箱 - JSON格式化 加解密 QR码 Android参考 Markdown | Tools24",
        "description": "Tools24 提供在线 JSON 格式化、编解码转换、Base64/32/16、加解密(AES/RSA)、二维码生成解析、Markdown 编辑、Android 开发速查、时间戳转换、文本对比、文件哈希等开发者工具。",
        "keywords": "在线工具,开发者工具,JSON格式化,编码转换,Base64,加解密,二维码生成,Markdown编辑器,Android速查,时间戳转换,文本对比,MD5校验",
        "intro": "Tools24 是面向开发者和日常办公的在线工具箱，提供编码转换、加解密、二维码、Markdown、Android 速查、JSON、Base64 等十余种常用工具。",
    },
    "en": {
        "name": "Tools24 Online Developer Toolbox",
        "title": "Tools24 Online Developer Toolbox - JSON Encryption QR Code Android Markdown | Tools24",
        "description": "Tools24 provides online developer tools: JSON formatting, codec converter, Base64/32/16, AES/RSA encryption, QR code generator & parser, Markdown editor, Android dev reference, timestamp, text diff, file hashing and more.",
        "keywords": "online tools,developer tools,JSON formatter,codec,Base64,encryption,QR code,Markdown editor,Android reference,timestamp converter,text diff,MD5 checker",
        "intro": "Tools24 is an online toolbox for developers and daily work, covering codecs, encryption, QR codes, Markdown, Android reference, JSON, Base64 and more.",
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


# --- Tool click stats (Redis hash: tool_clicks) ---
_TOOL_CLICK_KEY = "tool_clicks"


def _check_admin_token() -> bool:
    """Verify admin token from ?token= query param. Uses WISH_ADMIN_TOKEN env var."""
    token = request.args.get("token", "")
    admin = os.getenv("WISH_ADMIN_TOKEN", "")
    if not admin or not token:
        return False
    return hmac.compare_digest(token, admin)


@app.route("/api/tool-click", methods=["POST"])
def tool_click():
    """Increment click count for a tool. Body: {"tool_id": "json"}"""
    data = request.get_json(silent=True) or {}
    tool_id = data.get("tool_id", "")
    if not tool_id or tool_id == "home":
        return jsonify({"ok": False, "error": "invalid tool_id"}), 400
    count = cache_store.cache_hincrby(_TOOL_CLICK_KEY, tool_id)
    return jsonify({"ok": True, "tool_id": tool_id, "count": count})


@app.route("/api/tool-stats")
def tool_stats():
    """Return sorted tool click counts. ?view=1&token=xxx for admin dashboard."""
    stats = cache_store.cache_hgetall(_TOOL_CLICK_KEY)
    if not stats:
        stats = {}
    sorted_stats = sorted(stats.items(), key=lambda x: x[1], reverse=True)

    # Admin dashboard — ?view=1&token=xxx
    if request.args.get("view"):
        if not _check_admin_token():
            return Response("<h1>401 Unauthorized</h1><p>需要 ?token= 鉴权参数</p>", status=401)

        # tool ranking table
        tool_rows = ""
        for rank, (tid, count) in enumerate(sorted_stats, 1):
            name = TOOLS.get(tid, {}).get("zh", {}).get("name", tid)
            tool_rows += f'<tr><td>{rank}</td><td>{html.escape(name)}</td><td><code>{html.escape(tid)}</code></td><td>{count}</td></tr>'

        # visit count
        visit_count = cache_store.cache_get("visit_count") or "0"
        # total tool clicks
        total_clicks = sum(stats.values())

        # translate stats
        tr_count = cache_store.cache_get("translate_count") or "0"
        tr_history = cache_store.cache_lrange("translate_history", 0, 49)
        tr_rows = ""
        for item in tr_history:
            try:
                d = json.loads(item)
                tr_rows += f'<tr><td><code>{html.escape(d.get("dir",""))}</code></td><td>{html.escape(d.get("src",""))}</td><td>{html.escape(d.get("tgt",""))}</td></tr>'
            except Exception:
                pass

        html_page = f"""<!DOCTYPE html>
<meta charset="utf-8"><title>站点统计</title>
<style>
body{{font-family:system-ui;max-width:800px;margin:30px auto;padding:0 16px;background:#111;color:#eee}}
h1{{font-size:1.3rem;margin-bottom:4px}}h2{{font-size:1rem;margin:28px 0 10px;color:#ccc}}
table{{width:100%;border-collapse:collapse;margin-bottom:8px}}
th,td{{padding:7px 10px;text-align:left;border-bottom:1px solid #333}}
th{{color:#999;font-size:.75rem;font-weight:600}}
td{{font-size:.82rem}}tr:hover{{background:#1a1a1a}}
code{{color:#4fc3f7;font-size:.8rem}}
.badge{{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.7rem;background:#1a3a2a;color:#4caf50}}
.summary{{display:flex;gap:20px;margin:16px 0}}
.summary-card{{background:#1a1a1a;border-radius:10px;padding:14px 20px;min-width:120px}}
.summary-card .num{{font-size:2rem;font-weight:700;color:var(--accent,#4fc3f7)}}
.summary-card .label{{font-size:.75rem;color:#999;margin-top:2px}}
.sub{{font-size:.7rem;color:#666}}
</style>
<h1>📊 站点统计</h1>
<div class="summary">
<div class="summary-card"><div class="num">{visit_count}</div><div class="label">页面访问</div></div>
<div class="summary-card"><div class="num">{total_clicks}</div><div class="label">工具点击</div></div>
<div class="summary-card"><div class="num">{len(sorted_stats)}</div><div class="label">工具总数</div></div>
<div class="summary-card"><div class="num">{tr_count}</div><div class="label">翻译次数</div></div>
</div>

<h2>🔥 工具点击排行 <span class="sub">（所有用户累计，Redis HINCRBY）</span></h2>
<table><thead><tr><th>#</th><th>工具</th><th>ID</th><th>次数</th></tr></thead><tbody>{tool_rows}</tbody></table>

<h2>📝 最近翻译记录 <span class="sub">（最新 {len(tr_history)} 条）</span></h2>
<table><thead><tr><th>方向</th><th>原文</th><th>译文</th></tr></thead><tbody>{tr_rows or '<tr><td colspan="3" style="color:#666">暂无翻译记录</td></tr>'}</tbody></table>

<p class="sub" style="margin-top:24px">数据来源：Redis <code>dev_tools:tool_clicks</code> / <code>dev_tools:translate_history</code></p>"""
        return html_page

    # API: return sorted JSON (no auth)
    return jsonify(dict(sorted_stats))


# --- Translate API (DeepSeek) ---
_DEEPSEEK_KEY = os.getenv("DEV_TOOLS_DEEPSEEK_API_KEY", "")
_DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"


def _is_chinese(text: str) -> bool:
    """True if >30% characters are CJK."""
    if not text.strip():
        return False
    cjk = sum(1 for c in text if "一" <= c <= "鿿")
    return cjk / max(len(text), 1) > 0.3


def _is_short(text: str) -> bool:
    """True if ≤5 words."""
    return len(text.strip().split()) <= 5


def _build_prompt(text: str) -> str:
    """Build translation prompt based on language direction and length."""
    is_cn = _is_chinese(text)
    short = _is_short(text)

    if is_cn and short:
        return (
            "Translate this Chinese word/phrase to English.\n"
            "Return ONLY valid JSON (no markdown, no explanation):\n"
            '{"translation": "English translation", '
            '"phonetic": "Three lines separated by \\n:\\n'
            'Line1: IPA notation\\n'
            'Line2: 谐音「Chinese characters approximation」\\n'
            'Line3: English syllable respelling (stressed in UPPERCASE)\\n'
            'Examples:\\n'
            'strawberry → /ˈstrɔːbɛri/\\n谐音「斯抓伯瑞」\\nSTRAW-ber-ee\\n'
            'beautiful → /ˈbjuːtɪfəl/\\n谐音「标特否」\\nBYOO-ti-fuhl", '
            '"pos": "part of speech in English"}\n\n'
            f"Text: {text}"
        )
    if is_cn:
        return (
            "Translate the following Chinese text to fluent, natural English.\n"
            "Return ONLY valid JSON (no markdown, no explanation):\n"
            '{"translation": "the complete fluent translation"}\n\n'
            f"Text: {text}"
        )
    if short:
        return (
            "Translate this word/phrase to Simplified Chinese.\n"
            "Return ONLY valid JSON (no markdown, no explanation):\n"
            '{"translation": "中文翻译", '
            '"phonetic": "拼音 with tone marks. '
            'Format: pīn yīn (with tone marks on vowels, e.g. xī guā, měi lì, kuài lè)", '
            '"pos": "词性 in Chinese e.g. 名词/动词/形容词"}\n\n'
            f"Text: {text}"
        )
    # non-Chinese, long text → translate to Chinese
    return (
        "Translate the following text to fluent, natural Simplified Chinese.\n"
        "Return ONLY valid JSON (no markdown, no explanation):\n"
        '{"translation": "the complete fluent translation"}\n\n'
        f"Text: {text}"
    )


@app.route("/api/translate", methods=["POST"])
def translate():
    """Translate text via DeepSeek. Body: {"text": "..."}"""
    if not _DEEPSEEK_KEY:
        return jsonify({"ok": False, "error": "DeepSeek API key not configured"}), 503

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"ok": False, "error": "empty text"}), 400
    if len(text) > 5000:
        return jsonify({"ok": False, "error": "text too long (max 5000 chars)"}), 400

    prompt = _build_prompt(text)

    try:
        resp = requests.post(
            _DEEPSEEK_URL,
            headers={
                "Authorization": f"Bearer {_DEEPSEEK_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-v4-flash",
                "messages": [
                    {"role": "system", "content": "You are a professional translator. Always return valid JSON exactly as requested."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 2048,
            },
            timeout=15,
        )
        resp.raise_for_status()
        body = resp.json()
        raw = body["choices"][0]["message"]["content"].strip()

        # strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

        result = json.loads(raw)
    except (json.JSONDecodeError, KeyError, requests.RequestException) as e:
        logger.warning("Translate failed: %s", e)
        return jsonify({"ok": False, "error": "Translation failed, please retry"}), 500

    # record stats in Redis (fire-and-forget style, errors ignored)
    cache_store.cache_incr("translate_count")
    # keep recent 200 translations
    source_lang = "zh" if _is_chinese(text) else "auto"
    target_lang = "en" if _is_chinese(text) else "zh"
    entry = json.dumps({"src": text[:120], "tgt": result.get("translation", "")[:120], "dir": f"{source_lang}→{target_lang}"}, ensure_ascii=False)
    cache_store.cache_lpush("translate_history", entry)
    cache_store.cache_ltrim("translate_history", 0, 199)

    is_cn = _is_chinese(text)
    short = _is_short(text)
    return jsonify({
        "ok": True,
        "translation": result.get("translation", ""),
        "phonetic": result.get("phonetic") if short else None,
        "pos": result.get("pos") if short else None,
        "is_short": short,
        "source_lang": source_lang,
        "target_lang": target_lang,
    })



if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8731"))
    debug = os.getenv("FLASK_DEBUG", "").lower() in ("1", "true", "yes", "on")
    app.run(host=host, port=port, debug=debug)
