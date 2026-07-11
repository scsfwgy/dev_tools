import json
from pathlib import Path
from unittest.mock import Mock

import requests


def test_health_and_ip_routes(client):
    health = client.get("/api/health")
    ip = client.get("/api/ip", headers={"X-Forwarded-For": "203.0.113.10, 10.0.0.1"})

    assert health.status_code == 200
    assert health.get_json() == {"status": "ok"}
    assert ip.get_json() == {"ip": "203.0.113.10"}


def test_favorites_are_localized_and_wired(client):
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    app_script = client.get("/js/app.js").get_data(as_text=True)

    assert zh_locale["welcome"]["favorites"] == "收藏"
    assert en_locale["welcome"]["favorites"] == "Favorites"
    assert 'const STORAGE_FAVORITES = "devtools_favorites"' in app_script
    assert "function toggleFavorite(toolId)" in app_script
    assert 'class="menu-favorite' in app_script
    assert 't("welcome.favoritesEmpty")' in app_script


def test_image_tool_is_local_and_wired_with_seo_and_locales(client):
    page = client.get("/zh/tool/image")
    script = client.get("/js/image-tool.js")
    script_text = script.get_data(as_text=True)
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert page.status_code == 200
    assert "在线图片处理工具" in page.get_data(as_text=True)
    assert "https://www.tools24.uk/zh/tool/image" in page.get_data(as_text=True)
    assert script.status_code == 200
    assert "MAX_PIXELS = 40000000" in script_text
    assert "canvas.toBlob" in script_text
    assert "URL.createObjectURL" in script_text
    assert "fetch(" not in script_text
    assert "function resetSettings()" in script_text
    assert "exifr@7.1.3" in script_text
    assert "heic-to@1.5.2" in script_text
    assert "jszip@3.10.1" in script_text
    assert "function processBatch()" in script_text
    assert "function timestampName()" in script_text
    assert 'multiple hidden' in script_text
    assert 't("image.batchSizeSummary")' in script_text
    assert zh_locale["image"]["batchReduced"] == "减少 {percent}%"
    assert 'processButton.disabled = true' in script_text
    assert 't("image.downloadingButton")' in script_text
    assert 't("image.zippingButton")' in script_text
    assert "DateTimeOriginal" in script_text
    assert "GPSLatitude" in script_text
    assert zh_locale["menu"]["image"] == "图片处理"
    assert en_locale["menu"]["image"] == "Image Tool"
    assert zh_locale["image"]["metadataRemoved"] == "元数据已移除"
    assert index_html.index("image-tool.js") < index_html.index("app.js")


def test_file_converter_routes_are_local_and_lazy_loaded(client):
    page = client.get("/zh/tool/converter")
    script = client.get("/js/converter-tool.js")
    script_text = script.get_data(as_text=True)
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert page.status_code == 200
    assert "在线文件转换工具" in page.get_data(as_text=True)
    assert script.status_code == 200
    assert 'md: ["html", "txt", "pdf"]' in script_text
    assert 'docx: ["html", "txt"]' in script_text
    assert 'xlsx: ["csv", "html"]' in script_text
    assert "function renderSupportedRoutes()" in script_text
    assert sum(len(targets) for targets in ({"txt": ["html", "md", "pdf"], "html": ["txt", "md", "pdf"], "md": ["html", "txt", "pdf"], "csv": ["html", "xlsx"], "xlsx": ["csv", "html"], "docx": ["html", "txt"]}).values()) == 15
    assert "mammoth.browser.min.js" in script_text
    assert "xlsx.full.min.js" in script_text
    assert "function ensureScript" in script_text
    assert "function preparePdf(html)" in script_text
    assert "function downloadPdf()" in script_text
    assert 'backgroundColor: "#ffffff"' in script_text
    assert '.from(byId("converter-pdf-preview")).save()' in script_text
    assert "fetch(" not in script_text
    assert zh_locale["menu"]["converter"] == "文件转换"
    assert en_locale["menu"]["converter"] == "File Converter"
    assert zh_locale["converter"]["supportedRoutes"] == "当前支持的全部转换格式（15 项）"
    assert index_html.index("converter-tool.js") < index_html.index("app.js")
    app_css = (frontend_dir / "css" / "app.css").read_text()
    assert ".converter-pdf-preview { min-height: 480px" in app_css
    assert ".converter-preview.hidden, .converter-pdf-preview.hidden { display: none; }" in app_css


def test_spa_routes_render_seo_and_fallback(client):
    response = client.get("/en/tool/json")
    fallback = client.get("/fr/tool/unknown")

    html = response.get_data(as_text=True)
    assert response.status_code == 200
    assert '<html lang="en">' in html
    assert "https://www.tools24.uk/en/tool/json" in html
    assert "JSON Formatter and Validator Online" in html
    assert fallback.status_code == 200
    assert "<!--SEO_TITLE-->" in fallback.get_data(as_text=True)


def test_regex_and_http_tools_are_wired_with_seo_and_locales(client):
    regex_page = client.get("/zh/tool/regex")
    http_page = client.get("/en/tool/http")
    regex_script = client.get("/js/regex-tool.js")
    http_script = client.get("/js/http-tool.js")

    assert regex_page.status_code == 200
    assert "正则表达式测试工具" in regex_page.get_data(as_text=True)
    assert "https://www.tools24.uk/zh/tool/regex" in regex_page.get_data(as_text=True)
    assert http_page.status_code == 200
    assert "HTTP Status Codes and Headers Reference" in http_page.get_data(as_text=True)
    assert regex_script.status_code == 200
    assert "collectMatches" in regex_script.get_data(as_text=True)
    assert "COMMON_PATTERNS" in regex_script.get_data(as_text=True)
    assert "data-regex-tab" in regex_script.get_data(as_text=True)
    assert http_script.status_code == 200
    assert "Access-Control-Allow-Origin" in http_script.get_data(as_text=True)

    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert zh_locale["menu"]["regex"] == "正则测试"
    assert en_locale["menu"]["http"] == "HTTP Reference"
    assert index_html.index("regex-tool.js") < index_html.index("app.js")
    assert index_html.index("http-tool.js") < index_html.index("app.js")


def test_text_tool_is_wired_with_seo_and_locales(client):
    response = client.get("/zh/tool/text")
    script = client.get("/js/text-tool.js")

    assert response.status_code == 200
    assert "在线文本处理工具" in response.get_data(as_text=True)
    assert "https://www.tools24.uk/zh/tool/text" in response.get_data(as_text=True)
    assert script.status_code == 200
    assert "sqlIn" in script.get_data(as_text=True)

    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert zh_locale["menu"]["text"] == "文本处理"
    assert index_html.index("text-tool.js") < index_html.index("app.js")


def test_tax_tool_is_wired_with_seo_and_locales(client):
    response_zh = client.get("/zh/tool/tax")
    response_en = client.get("/en/tool/tax")
    script = client.get("/js/tax-tool.js")

    assert response_zh.status_code == 200
    assert "工资税收计算器" in response_zh.get_data(as_text=True)
    assert "https://www.tools24.uk/zh/tool/tax" in response_zh.get_data(as_text=True)
    assert response_en.status_code == 200
    assert "China Tax Calculator" in response_en.get_data(as_text=True)
    assert script.status_code == 200
    script_text = script.get_data(as_text=True)
    assert "MONTHLY_BRACKETS" in script_text
    assert "ANNUAL_BRACKETS" in script_text
    assert "calcBonusSeparate" in script_text
    assert "data-tax-tab" in script_text
    assert "tax-schedule-body" in script_text
    assert "tax-bracket-body" in script_text
    assert "tax-guide-example-body" in script_text
    assert 'data-tax-tab="guide"' in script_text
    assert "renderGuide" in script_text
    assert "fgk.chinatax.gov.cn" in script_text
    assert "P020240202362406243753.pdf" in script_text
    assert "cumulativeTaxable" in script_text
    assert "var separateTotal = roundMoney(result.annualTax + separateBonusTax)" in script_text

    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert zh_locale["menu"]["tax"] == "税收计算"
    assert en_locale["menu"]["tax"] == "Tax Calculator"
    assert zh_locale["tax"]["bracketsTab"] == "年度税阶拆分"
    assert zh_locale["tax"]["guideTab"] == "计算说明"
    assert en_locale["tax"]["scheduleTab"] == "Monthly Withholding Process"
    assert en_locale["tax"]["guideTab"] == "How It Works"
    assert index_html.index("tax-tool.js") < index_html.index("app.js")


def test_mortgage_tool_is_wired_with_seo_and_locales(client):
    response = client.get("/zh/tool/mortgage")
    script = client.get("/js/mortgage-tool.js")

    assert response.status_code == 200
    assert "房贷计算器" in response.get_data(as_text=True)
    assert "https://www.tools24.uk/zh/tool/mortgage" in response.get_data(as_text=True)
    assert script.status_code == 200
    script_text = script.get_data(as_text=True)
    assert "calcEqualInstallment" in script_text
    assert "calcEqualPrincipal" in script_text
    assert "renderHistory(byId(\"mg-history\"))" in script_text
    assert "updateAll();\n  }" in script_text
    assert "pbc.gov.cn" in script_text
    assert "chinamoney.com.cn/chinese/bklpr/" in script_text
    assert "bklpr3hischrt" not in script_text

    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert zh_locale["menu"]["mortgage"] == "房贷计算"
    assert en_locale["menu"]["mortgage"] == "Mortgage"
    assert zh_locale["mortgage"]["pbcLpr"] == "中国人民银行：LPR"
    assert en_locale["tax"]["officialWithholding"] == "STA: Cumulative Withholding Rules"
    assert index_html.index("mortgage-tool.js") < index_html.index("app.js")


def test_unit_converter_and_sidebar_use_shared_ui_states(client):
    unit_script = client.get("/js/unitconvert-tool.js").get_data(as_text=True)
    app_script = client.get("/js/app.js").get_data(as_text=True)

    assert "at-table uc-table" in unit_script
    assert "data-uc-category" in unit_script
    assert '"immersive"' in app_script
    assert "applySidebarState" in app_script


def test_ai_tool_uses_verified_commands_categories_and_comparison(client):
    page = client.get("/zh/tool/ai")
    script = client.get("/js/ai-tool.js")
    script_text = script.get_data(as_text=True)

    assert page.status_code == 200
    assert "Claude Code 与 Codex CLI 对照" in page.get_data(as_text=True)
    assert script.status_code == 200
    assert "COMPARISON" in script_text
    assert "data-ai-product" in script_text
    assert "data-ai-category" in script_text
    assert "claude mcp list" in script_text
    assert "claude --dangerously-skip-permissions -r" in script_text
    assert "codex review --uncommitted" in script_text
    assert "claude --mcp" not in script_text
    assert "codex test <file>" not in script_text
    assert "codex plan" not in script_text
    assert "--approve" not in script_text

    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    zh_locale = json.loads((frontend_dir / "locales" / "zh-CN.json").read_text())
    en_locale = json.loads((frontend_dir / "locales" / "en.json").read_text())
    index_html = (frontend_dir / "index.html").read_text()

    assert zh_locale["ai"]["comparison"] == "功能对照"
    assert en_locale["ai"]["categories"]["review"] == "Code Review"
    assert index_html.index("ai-tool.js") < index_html.index("app.js")


def test_visit_counter_is_read_only_then_increments(client):
    assert client.get("/api/visits").get_json() == {"count": 0}
    assert client.get("/api/visits").get_json() == {"count": 0}
    assert client.post("/api/visits/increment").get_json() == {"count": 1}
    assert client.get("/api/visits").get_json() == {"count": 1}


def test_translate_requires_api_key(client, monkeypatch):
    import app as app_module

    monkeypatch.setattr(app_module, "_DEEPSEEK_KEY", "")

    response = client.post("/api/translate", json={"text": "hello"})

    assert response.status_code == 503
    assert response.get_json()["ok"] is False


def test_translate_validates_input(client, monkeypatch):
    import app as app_module

    monkeypatch.setattr(app_module, "_DEEPSEEK_KEY", "test-key")

    empty = client.post("/api/translate", json={"text": "  "})
    too_long = client.post("/api/translate", json={"text": "x" * 5001})

    assert empty.status_code == 400
    assert too_long.status_code == 400


def test_translate_parses_success_response(client, monkeypatch):
    import app as app_module

    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "choices": [{"message": {"content": "```json\n{\"translation\": \"你好\", \"phonetic\": \"nǐ hǎo\", \"pos\": \"感叹词\"}\n```"}}]
    }
    post = Mock(return_value=response)
    monkeypatch.setattr(app_module, "_DEEPSEEK_KEY", "test-key")
    monkeypatch.setattr(app_module.requests, "post", post)

    result = client.post("/api/translate", json={"text": "hello"})

    assert result.status_code == 200
    assert result.get_json() == {
        "ok": True,
        "translation": "你好",
        "phonetic": "nǐ hǎo",
        "pos": "感叹词",
        "is_short": True,
        "source_lang": "auto",
        "target_lang": "zh",
    }
    assert post.call_args.kwargs["timeout"] == 15


def test_translate_handles_request_failure(client, monkeypatch):
    import app as app_module

    monkeypatch.setattr(app_module, "_DEEPSEEK_KEY", "test-key")
    monkeypatch.setattr(
        app_module.requests,
        "post",
        Mock(side_effect=requests.RequestException("unavailable")),
    )

    response = client.post("/api/translate", json={"text": "hello"})

    assert response.status_code == 500
    assert response.get_json()["ok"] is False


def test_translation_helpers_cover_language_and_length():
    import app as app_module

    assert app_module._is_chinese("你好世界") is True
    assert app_module._is_chinese("hello") is False
    assert app_module._is_short("one two three four five") is True
    assert app_module._is_short("one two three four five six") is False
    assert "English translation" in app_module._build_prompt("你好")
    assert "Simplified Chinese" in app_module._build_prompt("hello world")
