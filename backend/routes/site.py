"""Site and SEO routes."""
import hashlib
import html
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, Response, abort, jsonify, redirect, send_from_directory

import app_settings
from http_utils import _client_ip
from tool_data import HOME_META, TOOLS, TOOL_REGISTRY, TOOL_SUBPAGES

site_bp = Blueprint("site", __name__)


def content_last_modified():
    override = os.getenv("SEO_LAST_MODIFIED")
    if override:
        return override
    try:
        result = subprocess.run(
            [
                "git", "log", "-1", "--format=%cs", "--",
                "backend/app.py", "backend/tool_data.py", "backend/routes/site.py",
                "frontend/index.html", "frontend/css", "frontend/js", "frontend/locales",
            ],
            cwd=app_settings.FRONTEND_DIR.parent,
            check=True,
            capture_output=True,
            text=True,
            timeout=2,
        )
        if result.stdout.strip():
            return result.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    content_paths = [
        Path(__file__),
        app_settings.FRONTEND_DIR / "js" / "app.js",
        app_settings.FRONTEND_DIR / "locales" / "zh-CN.json",
        app_settings.FRONTEND_DIR / "locales" / "en.json",
    ]
    latest_mtime = max(path.stat().st_mtime for path in content_paths)
    return datetime.fromtimestamp(latest_mtime, tz=timezone.utc).date().isoformat()


def asset_version():
    """Return a cache-busting version suited to deployment or local editing.

    Deployed assets use an explicit build version or Vercel's commit SHA and
    can therefore be cached immutably. Local files use a stat fingerprint so
    an uncommitted edit changes the URL without requiring a Git commit.
    """
    explicit_version = os.getenv("ASSET_VERSION")
    if explicit_version:
        return explicit_version.strip()[:16]
    vercel_sha = os.getenv("VERCEL_GIT_COMMIT_SHA")
    if vercel_sha:
        return vercel_sha.strip()[:8]
    digest = hashlib.sha256()
    asset_paths = [app_settings.FRONTEND_DIR / "index.html"]
    for directory in ("css", "js", "locales"):
        root = app_settings.FRONTEND_DIR / directory
        if root.exists():
            asset_paths.extend(path for path in root.rglob("*") if path.is_file())
    for path in sorted(asset_paths):
        try:
            stat = path.stat()
        except OSError:
            continue
        digest.update(str(path.relative_to(app_settings.FRONTEND_DIR)).encode("utf-8"))
        digest.update(f":{stat.st_mtime_ns}:{stat.st_size}".encode("ascii"))
    return "dev-" + digest.hexdigest()[:12]


def immutable_asset_cache_enabled():
    """Whether asset URLs are tied to an explicit immutable build version."""
    return bool(os.getenv("ASSET_VERSION") or os.getenv("VERCEL_GIT_COMMIT_SHA"))


def public_tool_ids():
    return [tool_id for tool_id, config in sorted(TOOL_REGISTRY.items(), key=lambda item: item[1]["order"]) if config["indexable"]]


def render_spa(lang, tool_id, indexable=True, subpage=None):
    template = (app_settings.FRONTEND_DIR / "index.html").read_text(encoding="utf-8")
    seo_tool_id = tool_id if tool_id and indexable else None
    meta = TOOLS[seo_tool_id][lang] if seo_tool_id else HOME_META[lang]
    if subpage:
        meta = {**meta, **TOOL_SUBPAGES[tool_id][subpage][lang]}
    path = f"/{lang}/{tool_id}/{subpage}" if subpage else (f"/{lang}/tool/{tool_id}" if tool_id else f"/{lang}/")
    canonical = f"{app_settings.SITE_URL}{path}"
    paired_path = f"/{tool_id}/{subpage}" if subpage else (f"/tool/{tool_id}" if tool_id else "/")
    replacements = {
        "<!--SEO_HTML_LANG-->": "zh-CN" if lang == "zh" else "en",
        "<!--SEO_ROBOTS-->": "index,follow" if indexable else "noindex,nofollow",
        "<!--SEO_TITLE-->": html.escape(meta["title"], quote=True),
        "<!--SEO_DESCRIPTION-->": html.escape(meta["description"], quote=True),
        "<!--SEO_KEYWORDS-->": html.escape(meta["keywords"], quote=True),
        "<!--SEO_CANONICAL-->": canonical,
        "<!--SEO_HREFLANG_ZH-->": f"{app_settings.SITE_URL}/zh{paired_path}",
        "<!--SEO_HREFLANG_EN-->": f"{app_settings.SITE_URL}/en{paired_path}",
        "<!--SEO_HREFLANG_DEFAULT-->": f"{app_settings.SITE_URL}/zh{paired_path}",
        "<!--SEO_OG_LOCALE-->": "zh_CN" if lang == "zh" else "en_US",
        "<!--SEO_OG_LOCALE_ALTERNATE-->": "en_US" if lang == "zh" else "zh_CN",
        "<!--SEO_SCHEMA-->": html.escape(json.dumps(build_schema(lang, seo_tool_id, canonical, meta), ensure_ascii=False), quote=False),
        "<!--SEO_CONTENT-->": build_seo_content(lang, seo_tool_id, meta, subpage=subpage) if indexable else "",
        "<!--SEO_ASSET_VERSION-->": asset_version(),
    }
    for marker, value in replacements.items():
        template = template.replace(marker, value)
    response = Response(template, mimetype="text/html")
    response.headers["Content-Language"] = "zh-CN" if lang == "zh" else "en"
    return response


def build_schema(lang, tool_id, canonical, meta):
    application = {
        "@type": "WebApplication",
        "@id": f"{canonical}#application",
        "name": meta["name"],
        "url": canonical,
        "description": meta["description"],
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "Any",
        "inLanguage": "zh-CN" if lang == "zh" else "en",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "isAccessibleForFree": True,
        "browserRequirements": "Requires JavaScript and a modern web browser",
        "featureList": meta.get("features", []),
    }
    if tool_id:
        faq_entries = meta.get("faq", TOOLS[tool_id][lang]["faq"])
        faq = {
            "@type": "FAQPage",
            "@id": f"{canonical}#faq",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": question,
                    "acceptedAnswer": {"@type": "Answer", "text": answer},
                }
                for question, answer in faq_entries
            ],
        }
        application["mainEntity"] = {"@id": faq["@id"]}
        breadcrumb = {
            "@type": "BreadcrumbList",
            "@id": f"{canonical}#breadcrumb",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": HOME_META[lang]["name"], "item": f"{app_settings.SITE_URL}/{lang}/"},
                {"@type": "ListItem", "position": 2, "name": meta["name"], "item": canonical},
            ],
        }
        return {"@context": "https://schema.org", "@graph": [application, faq, breadcrumb]}
    website = {
        "@type": "WebSite",
        "@id": f"{canonical}#website",
        "name": meta["name"],
        "url": canonical,
        "description": meta["description"],
        "inLanguage": "zh-CN" if lang == "zh" else "en",
    }
    return {"@context": "https://schema.org", "@graph": [website, application]}


def _related_links(lang, tool_id, subpage=None):
    related_tools = {
        "diff": ("format", "json", "text"),
        "json": ("format", "diff", "base64", "jwt"),
        "fileinfo": ("base64", "crypto", "converter"),
        "base64": ("encoder", "fileinfo", "crypto"),
    }
    links = []
    for related_id in related_tools.get(tool_id, ()):
        links.append((f"/{lang}/tool/{related_id}", TOOLS[related_id][lang]["name"]))

    if tool_id == "android":
        if subpage:
            links.append((f"/{lang}/tool/android", TOOLS["android"][lang]["name"]))
        for related_subpage in ("permissions", "adb", "intent", "compose"):
            if related_subpage == subpage:
                continue
            related_meta = TOOL_SUBPAGES["android"][related_subpage][lang]
            links.append((f"/{lang}/android/{related_subpage}", related_meta["name"]))
    return links


def build_seo_content(lang, tool_id, meta, subpage=None):
    nav = "".join(
        f'<li><a href="/{lang}/tool/{tool_id_item}">{html.escape(TOOLS[tool_id_item][lang]["name"])}</a></li>'
        for tool_id_item in public_tool_ids()
    )
    if not tool_id:
        heading = html.escape(meta["name"])
        intro = html.escape(meta["intro"])
        return (
            '<section class="seo-content">'
            f"<h1>{heading}</h1><p>{intro}</p>"
            f"<h2>{'常用在线工具' if lang == 'zh' else 'Online Developer Tools'}</h2><ul>{nav}</ul>"
            f"<p>{'绝大多数工具在浏览器本地处理，数据无需上传；少数需要服务端的工具会明确标记。' if lang == 'zh' else 'Most tools process data locally in your browser. Tools that require a server are clearly identified.'}</p>"
            "</section>"
        )

    features = "".join(f"<li>{html.escape(feature)}</li>" for feature in meta["features"])
    faq = "".join(
        f"<h3>{html.escape(question)}</h3><p>{html.escape(answer)}</p>"
        for question, answer in meta["faq"]
    )
    processing = TOOL_REGISTRY[tool_id]["processing"]
    processing_text = {
        "zh": {"local": "浏览器本地处理，数据不上传", "hybrid": "部分信息需要请求服务端", "server": "服务端处理，数据会发送到服务器"},
        "en": {"local": "Processed locally in your browser; data is not uploaded", "hybrid": "Some information requires a server request", "server": "Processed on the server; data is sent to the service"},
    }[lang][processing]
    related_links = _related_links(lang, tool_id, subpage)
    related_nav = "".join(
        f'<li><a href="{html.escape(path, quote=True)}">{html.escape(label)}</a></li>'
        for path, label in related_links
    ) or nav
    related_heading = "相关工具" if lang == "zh" else "Related tools"
    return (
        '<section class="seo-content">'
        f"<h1>{html.escape(meta['name'])}</h1><p>{html.escape(meta['intro'])}</p>"
        f'<p class="privacy-badge privacy-badge-{processing}">{html.escape(processing_text)}</p>'
        f"<h2>{'功能特点' if lang == 'zh' else 'Features'}</h2><ul>{features}</ul>"
        f"<h2>{'常见问题' if lang == 'zh' else 'FAQ'}</h2>{faq}"
        f"<h2>{related_heading}</h2><ul>{related_nav}</ul>"
        "</section>"
    )


@site_bp.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@site_bp.route("/api/tool-manifest")
def tool_manifest():
    tools = []
    for tool_id, config in sorted(TOOL_REGISTRY.items(), key=lambda item: item[1]["order"]):
        seo = None
        if config["indexable"]:
            seo = {
                "zh-CN": {"title": TOOLS[tool_id]["zh"]["title"], "description": TOOLS[tool_id]["zh"]["description"]},
                "en": {"title": TOOLS[tool_id]["en"]["title"], "description": TOOLS[tool_id]["en"]["description"]},
            }
        tool = {"id": tool_id, "i18n": f"menu.{tool_id}", "seo": seo, **config}
        if tool.get("script"):
            # 剥掉 TOOL_REGISTRY 中可能残留的旧 ?v=，统一由 asset_version 注入，避免出现双 ?v=
            base = tool["script"].split("?", 1)[0]
            tool["script"] = f"{base}?v={asset_version()}"
        tools.append(tool)
    return jsonify({
        "siteUrl": app_settings.SITE_URL,
        "lastModified": content_last_modified(),
        "homeSeo": {
            "zh-CN": {"title": HOME_META["zh"]["title"], "description": HOME_META["zh"]["description"]},
            "en": {"title": HOME_META["en"]["title"], "description": HOME_META["en"]["description"]},
        },
        "tools": tools,
    })


@site_bp.route("/robots.txt")
def robots():
    return Response(
        f"User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: {app_settings.SITE_URL}/sitemap.xml\n",
        mimetype="text/plain",
    )


@site_bp.route("/sitemap.xml")
def sitemap():
    last_modified = content_last_modified()
    urls = []
    for lang in ("zh", "en"):
        urls.append((f"{app_settings.SITE_URL}/{lang}/", lang, None))
        for tool_id in public_tool_ids():
            urls.append((f"{app_settings.SITE_URL}/{lang}/tool/{tool_id}", lang, tool_id))
        for tool_id, subpages in TOOL_SUBPAGES.items():
            for subpage in subpages:
                urls.append((f"{app_settings.SITE_URL}/{lang}/{tool_id}/{subpage}", lang, tool_id))
    body = "\n".join(
        (
            f"  <url><loc>{loc}</loc><lastmod>{last_modified}</lastmod><changefreq>weekly</changefreq>"
            f"<priority>{'1.0' if _tool_id is None else '0.8'}</priority>"
            f'<xhtml:link rel="alternate" hreflang="zh-CN" href="{app_settings.SITE_URL}/zh{loc.split(f"/{_lang}", 1)[1]}"/>'
            f'<xhtml:link rel="alternate" hreflang="en" href="{app_settings.SITE_URL}/en{loc.split(f"/{_lang}", 1)[1]}"/>'
            f'<xhtml:link rel="alternate" hreflang="x-default" href="{app_settings.SITE_URL}/zh{loc.split(f"/{_lang}", 1)[1]}"/>'
            "</url>"
        )
        for loc, _lang, _tool_id in urls
    )
    xml = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n{body}\n</urlset>\n'
    return Response(xml, mimetype="application/xml")


@site_bp.route("/")
def index():
    return redirect("/zh/", code=308)


@site_bp.route("/<lang>")
def index_lang_redirect(lang):
    if lang not in app_settings.SUPPORTED_LANGS:
        abort(404)
    return redirect(f"/{lang}/", code=308)


@site_bp.route("/<lang>/")
def index_lang(lang):
    if lang not in app_settings.SUPPORTED_LANGS:
        abort(404)
    return render_spa(lang, None)


@site_bp.route("/<lang>/tool/<tool_id>")
def tool_lang(lang, tool_id):
    config = TOOL_REGISTRY.get(tool_id)
    if lang not in app_settings.SUPPORTED_LANGS or not config:
        abort(404)
    return render_spa(lang, tool_id, indexable=config["indexable"])


@site_bp.route("/<lang>/<tool_id>/<subpage>")
def tool_subpage(lang, tool_id, subpage):
    if lang not in app_settings.SUPPORTED_LANGS or subpage not in TOOL_SUBPAGES.get(tool_id, {}):
        abort(404)
    return render_spa(lang, tool_id, subpage=subpage)


@site_bp.route("/<path:filename>")
def frontend_files(filename):
    return send_from_directory(str(app_settings.FRONTEND_DIR), filename)


@site_bp.route("/api/ip")
def ip_info():
    return jsonify({"ip": _client_ip()})
