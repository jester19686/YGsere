
# -*- coding: utf-8 -*-
"""
cards_editor_no_abilities.py — редактор SERVER/data/cards.js
Фичи:
  • Простые списки: GENDERS, BODIES, TRAITS, PROFESSIONS, HEALTHS, HOBBIES, PHOBIAS, BIG_ITEMS, BACKPACK, EXTRAS
  • Объекты: BUNKERS, CATAclySMS
  • Кнопки: "⬇️ Скачать данные из GitHub", "↻ Перезагрузка"
  • Автоподкачка: если cards.js отсутствует — скачиваем из GitHub (по умолчанию jester19686/YGsere@main)
  • ABILITIES не изменяется и не теряется

Запуск: python cards_editor_no_abilities.py
"""

import os
import re
import io
import zipfile
import urllib.request
from typing import Optional, Tuple, List, Dict, Any
from pathlib import Path
from flask import Flask, request, redirect, url_for, render_template_string, flash

# ---------- Пути и конфиг ----------
BASE_DIR = Path(__file__).resolve().parent
# По умолчанию всегда смотрим в ./data/cards.js рядом со скриптом
FILE_PATH = Path(os.environ.get("CARDS_PATH") or (BASE_DIR / "data" / "cards.js")).resolve()

ARRAY_KEYS: List[str] = [
    "GENDERS", "BODIES", "TRAITS", "PROFESSIONS", "HEALTHS",
    "HOBBIES", "PHOBIAS", "BIG_ITEMS", "BACKPACK", "EXTRAS"
]

LABELS: Dict[str, str] = {
    "GENDERS": "GENDERS - Пол",
    "BODIES": "BODIES - Телосложение",
    "TRAITS": "TRAITS - Человеческая черта",
    "PROFESSIONS": "PROFESSIONS - Профессия",
    "HEALTHS": "HEALTHS - Здоровье",
    "HOBBIES": "HOBBIES - Хобби/Увлечение",
    "PHOBIAS": "PHOBIAS - Фобия/Страх",
    "BIG_ITEMS": "BIG_ITEMS - Крупный инвентарь",
    "BACKPACK": "BACKPACK - Рюкзак",
    "EXTRAS": "EXTRAS - Доп. сведение",
}

app = Flask(__name__)
app.secret_key = "cards-editor-secret"

# --- GitHub источники по умолчанию ---
GITHUB_REPO = os.environ.get('CARDS_GITHUB_REPO', 'jester19686/YGsere')
GITHUB_BRANCH = os.environ.get('CARDS_GITHUB_BRANCH', 'main')
IMAGES_DIR = (BASE_DIR / 'client' / 'public' / 'cataclysms')

# ---------- GitHub Sync ----------
def _download_repo_zip(repo: str, branch: str) -> bytes:
    url = f"https://codeload.github.com/{repo}/zip/refs/heads/{branch}"
    with urllib.request.urlopen(url) as resp:
        return resp.read()

def _extract_and_copy(zip_bytes: bytes) -> int:
    """Копирует data/cards.js и client/public/cataclysms/* из архива репо в локальные папки."""
    changed = 0
    zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    # Имя корневой папки в архиве, например YGsere-main/
    root = zf.namelist()[0].split('/')[0]

    # 1) cards.js
    cards_member = f"{root}/data/cards.js"
    if cards_member in zf.namelist():
        data = zf.read(cards_member)
        FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        old = FILE_PATH.read_bytes() if FILE_PATH.exists() else b""
        if old != data:
            FILE_PATH.write_bytes(data)
            changed += 1

    # 2) изображения катаклизмов
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    prefix = f"{root}/client/public/cataclysms/"
    for name in zf.namelist():
        if name.startswith(prefix) and not name.endswith('/'):
            rel = name[len(prefix):]
            if not rel:
                continue
            dst = IMAGES_DIR / rel
            data = zf.read(name)
            if not dst.exists() or dst.read_bytes() != data:
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_bytes(data)
                changed += 1
    return changed

def sync_from_github(repo: str = GITHUB_REPO, branch: str = GITHUB_BRANCH) -> int:
    blob = _download_repo_zip(repo, branch)
    return _extract_and_copy(blob)

# ---------- Общие утилиты ----------
def load_text() -> str:
    # Автоподкачка, если файла нет
    if not FILE_PATH.exists():
        try:
            changed = sync_from_github(GITHUB_REPO, GITHUB_BRANCH)
            print(f"[INFO] Автоскачивание из GitHub: обновлено файлов {changed}")
        except Exception as e:
            raise FileNotFoundError(f"Не найден {FILE_PATH}, и не удалось скачать: {e}")
    return FILE_PATH.read_text(encoding="utf-8")

def save_text(text: str) -> None:
    FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    FILE_PATH.write_text(text, encoding="utf-8")

def find_block(text: str, key: str) -> Optional[Tuple[int, int, str]]:
    """Возвращает (start, end, inner) для 'const KEY = [ inner ];'"""
    m = re.search(rf"(const\s+{re.escape(key)}\s*=\s*\[)(.*?)(\]\s*;)", text, flags=re.DOTALL | re.UNICODE)
    if not m:
        return None
    return (m.start(1), m.end(3), m.group(2))

def extract_verbatim(text: str, key: str) -> Optional[str]:
    m = re.search(rf"const\s+{re.escape(key)}\s*=\s*\[(.*?)\]\s*;", text, flags=re.DOTALL | re.UNICODE)
    return m.group(0) if m else None

def parse_array(text: str, key: str) -> List[str]:
    blk = find_block(text, key)
    if not blk:
        return []
    return re.findall(r"'([^']*)'", blk[2])

def replace_array(text: str, key: str, items: List[str]) -> str:
    inner = ",\n  ".join(f"'{s.strip()}'" for s in items if s.strip())
    new_block = f"const {key} = [\n  {inner}\n];"
    blk = find_block(text, key)
    if blk:
        s, e, _ = blk
        return text[:s] + new_block + text[e:]
    return re.sub(r"module\.exports\s*=\s*\{", new_block + "\n\nmodule.exports = {", text, count=1)

# ---------- Хелперы для массивов объектов ----------
def _find_array_span(text: str, const_name: str) -> Optional[Tuple[int, int]]:
    m = re.search(rf"const\s+{re.escape(const_name)}\s*=\s*\[", text)
    if not m:
        return None
    i = m.end()
    depth = 1
    while i < len(text) and depth > 0:
        ch = text[i]
        if ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
        i += 1
    if depth != 0:
        return None
    return (m.end(), i-1)

def _split_top_level_objects(block: str) -> List[str]:
    objs: List[str] = []
    depth = 0
    start = None
    i = 0
    while i < len(block):
        ch = block[i]
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start is not None:
                objs.append(block[start:i+1])
                start = None
        i += 1
    return objs

# ---------- CATAclySMS ----------
def parse_cataclysms(text: str) -> List[Dict[str, str]]:
    span = _find_array_span(text, "CATAclySMS")
    if not span:
        return []
    block = text[span[0]:span[1]]
    raw_objs = _split_top_level_objects(block)
    items: List[Dict[str, str]] = []
    for raw in raw_objs:
        def get(patterns: List[str]) -> str:
            for pat in patterns:
                m = re.search(pat, raw, flags=re.DOTALL | re.UNICODE)
                if m:
                    return m.group(1)
            return ""
        items.append({
            "id":   get([r"id:\s*'([^']*)'"]),
            "title":get([r"title:\s*'([^']*)'"]),
            "description": get([r"description:\s*'([\s\S]*?)'", r"text:\s*'([\s\S]*?)'"]),
            "image":get([r"image:\s*'([^']*)'"]),
        })
    return items

def replace_cataclysms(text: str, items: List[Dict[str, str]], original_text: str) -> str:
    normalized: List[Dict[str, str]] = []
    for o in items:
        idv = (o.get("id","") or "").strip()
        ttl = (o.get("title","") or "").strip()
        dsc = (o.get("description","") or "")
        img = (o.get("image","") or "").strip()
        if img and not img.startswith("/") and not img.startswith("http"):
            img = f"/cataclysms/{img}"
        if any((idv, ttl, dsc.strip(), img)):
            normalized.append({"id": idv, "title": ttl, "description": dsc, "image": img})
    if not normalized:
        return text

    def fmt(o: Dict[str,str]) -> str:
        desc = (o.get("description","") or "").replace("\\","\\\\").replace("'","\\'").replace("\r\n","\n").replace("\n","\\n")
        img = (o.get("image","") or "")
        return (
            "{\n"
            f"    id: '{o.get('id','')}',\n"
            f"    title: '{o.get('title','Катаклизм')}',\n"
            f"    description:\n"
            f"      '{desc}',\n"
            f"    image: '{img}',\n"
            "  }"
        )
    inner = ",\n  ".join(fmt(o) for o in normalized)
    new_block = f"const CATAclySMS = [\n  {inner},\n];"
    pattern = r"const\s+CATAclySMS\s*=\s*\[(.*?)\]\s*;"
    if re.search(pattern, text, flags=re.DOTALL | re.UNICODE):
        return re.sub(pattern, new_block, text, flags=re.DOTALL | re.UNICODE)
    return re.sub(r"module\.exports\s*=\s*\{", new_block + "\n\nmodule.exports = {", text, count=1)

# ---------- BUNKERS ----------
def parse_bunkers(text: str) -> List[Dict[str, Any]]:
    span = _find_array_span(text, "BUNKERS")
    if not span:
        return []
    block = text[span[0]:span[1]]
    raw_objs = _split_top_level_objects(block)
    res: List[Dict[str, Any]] = []
    for raw in raw_objs:
        def gets(pats: List[str]) -> str:
            for p in pats:
                m = re.search(p, raw, flags=re.DOTALL | re.UNICODE)
                if m:
                    return m.group(1)
            return ""
        def getn(p: str) -> int:
            m = re.search(p, raw, flags=re.DOTALL | re.UNICODE)
            return int(m.group(1)) if m else 0
        items_block = re.search(r"items:\s*\[(.*?)\]", raw, flags=re.DOTALL | re.UNICODE)
        items = re.findall(r"'([^']*)'", items_block.group(1)) if items_block else []
        res.append({
            "description": gets([r"description:\s*'([\s\S]*?)'"]),
            "items": items,
            "sizeM2": getn(r"sizeM2:\s*(\d+)"),
            "stayText": gets([r"stayText:\s*'([\s\S]*?)'"]),
            "foodText": gets([r"foodText:\s*'([\s\S]*?)'"]),
            "places": getn(r"places:\s*(\d+)"),
        })
    return res

def replace_bunkers(text: str, bunkers: List[Dict[str, Any]]) -> str:
    valid = []
    for b in bunkers:
        if any([
            (b.get("description") or "").strip(),
            b.get("items"),
            int(b.get("sizeM2") or 0) > 0,
            (b.get("stayText") or "").strip(),
            (b.get("foodText") or "").strip(),
            int(b.get("places") or 0) > 0,
        ]):
            valid.append(b)
    if not valid:
        return text

    def esc(s: str) -> str:
        return (s or "").replace("\\","\\\\").replace("'","\\'").replace("\r\n","\n").replace("\n","\\n")

    def fmt_items(lst: List[str]) -> str:
        inner = ", ".join(f"'{esc(x)}'" for x in lst if str(x).strip())
        return f"[{inner}]"

    def fmt_obj(b: Dict[str, Any]) -> str:
        return (
            "{\n"
            f"    description:\n"
            f"      '{esc(str(b.get('description','')))}',\n"
            f"    items: {fmt_items(list(b.get('items', [])))},\n"
            f"    sizeM2: {int(b.get('sizeM2') or 0)},\n"
            f"    stayText: '{esc(str(b.get('stayText','')))}',\n"
            f"    foodText: '{esc(str(b.get('foodText','')))}',\n"
            f"    places: {int(b.get('places') or 0)},\n"
            "  }"
        )
    inner = ",\n  ".join(fmt_obj(b) for b in valid)
    new_block = f"const BUNKERS = [\n  {inner},\n];"
    pattern = r"const\s+BUNKERS\s*=\s*\[(.*?)\]\s*;"
    if re.search(pattern, text, flags=re.DOTALL | re.UNICODE):
        return re.sub(pattern, new_block, text, flags=re.DOTALL | re.UNICODE)
    return re.sub(r"module\.exports\s*=\s*\{", new_block + "\n\nmodule.exports = {", text, count=1)

# ---------- ABILITIES сохранение ----------
def ensure_abilities_preserved(original_text: str, new_text: str) -> str:
    if extract_verbatim(new_text, "ABILITIES"):
        return new_text
    orig = extract_verbatim(original_text, "ABILITIES")
    if orig:
        return re.sub(r"module\.exports\s*=\s*\{", orig + "\n\nmodule.exports = {", new_text, count=1)
    fallback = "const ABILITIES = [\n  // редактор не изменяет этот блок\n];"
    return re.sub(r"module\.exports\s*=\s*\{", fallback + "\n\nmodule.exports = {", new_text, count=1)

# ---------- Flask ----------
@app.route("/", endpoint="index", methods=["GET", "POST"])
def index():
    original_text = load_text()
    text = original_text

    if request.method == "POST":
        # простые списки
        for key in ARRAY_KEYS:
            items = [s.strip() for s in request.form.getlist(f"{key}_item") if s.strip()]
            text = replace_array(text, key, items)

        # бункеры
        idxs = request.form.getlist("bunk_idx")
        bunkers: List[Dict[str, Any]] = []
        for i in idxs:
            desc = request.form.get(f"bunk_desc_{i}", "") or ""
            size = request.form.get(f"bunk_size_{i}", "0") or "0"
            stay = request.form.get(f"bunk_stay_{i}", "") or ""
            food = request.form.get(f"bunk_food_{i}", "") or ""
            places = request.form.get(f"bunk_places_{i}", "0") or "0"
            items = [s.strip() for s in request.form.getlist(f"bunk_item_{i}") if s.strip()]
            bunkers.append({
                "description": desc,
                "items": items,
                "sizeM2": int(size) if str(size).isdigit() else 0,
                "stayText": stay,
                "foodText": food,
                "places": int(places) if str(places).isdigit() else 0,
            })
        text = replace_bunkers(text, bunkers)

        # катаклизмы
        ids = request.form.getlist("cat_id")
        titles = request.form.getlist("cat_title")
        descs = request.form.getlist("cat_description")
        images = request.form.getlist("cat_image")
        cats: List[Dict[str, str]] = []
        maxlen = max(len(ids), len(titles), len(descs), len(images)) if any([ids, titles, descs, images]) else 0
        for i in range(maxlen):
            cats.append({
                "id": (ids[i] if i < len(ids) else "").strip(),
                "title": (titles[i] if i < len(titles) else "").strip(),
                "description": (descs[i] if i < len(descs) else ""),
                "image": (images[i] if i < len(images) else "").strip(),
            })
        text = replace_cataclysms(text, cats, original_text)

        text = ensure_abilities_preserved(original_text, text)
        save_text(text)
        flash("Изменения сохранены ✅")
        return redirect(url_for("index"))

    arrays = {key: parse_array(text, key) for key in ARRAY_KEYS}
    bunkers = parse_bunkers(text)
    cats = parse_cataclysms(text)

    return render_template_string(TPL, arrays=arrays, bunkers=bunkers, cats=cats,
                                  array_keys=ARRAY_KEYS, labels=LABELS, file_path=str(FILE_PATH),
                                  GITHUB_REPO=GITHUB_REPO, GITHUB_BRANCH=GITHUB_BRANCH)

# ---------- Доп. роуты ----------
@app.route("/sync", methods=["POST"])
def sync_action():
    repo = request.form.get("repo") or GITHUB_REPO
    branch = request.form.get("branch") or GITHUB_BRANCH
    try:
        changed = sync_from_github(repo, branch)
        flash(f"Синхронизация завершена ✅ Обновлено файлов: {changed}")
    except Exception as e:
        flash(str(e))
    return redirect(url_for("index"))

@app.route("/reload", methods=["GET"])
def reload_action():
    flash("Перезагрузка интерфейса выполнена 🔄")
    return redirect(url_for("index"))

# ---------- Шаблон ----------
TPL = r"""
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <title>Редактор cards.js</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;background:#0b0f14;color:#e6edf3}
    header{padding:16px 20px;background:#111826;position:sticky;top:0;border-bottom:1px solid #1f2937}
    h1{margin:0;font-size:18px}
    main{padding:18px;max-width:1100px;margin:0 auto}
    .card{background:#0f1624;border:1px solid #1f2937;border-radius:12px;margin-bottom:16px;padding:16px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    input[type=text], textarea, input[type=number]{width:100%;background:#0b1220;color:#e6edf3;border:1px solid #273144;border-radius:8px;padding:8px}
    .btn{background:#2563eb;border:none;color:#fff;padding:10px 16px;border-radius:10px;cursor:pointer}
    .btn.secondary{background:#374151}
    .row{display:grid;grid-template-columns:42px 1fr;gap:8px;align-items:center}
    .row input{height:38px}
    .muted{opacity:.8;font-size:12px}
    .pill{display:inline-block;background:#111827;border:1px solid #273144;border-radius:999px;padding:4px 10px;margin:4px 6px 0 0}
    .flash{background:#064e3b;border:1px solid #065f46;color:#d1fae5;padding:10px 12px;border-radius:10px;margin-bottom:10px}
    .sticky-actions{position:sticky;bottom:0;display:flex;gap:12px;background:linear-gradient(180deg, rgba(11,15,20,0), #0b0f14 24%);padding:12px}
    .hr{height:1px;background:#1f2937;margin:12px 0}
    .num{display:flex;align-items:center;justify-content:center;background:#111827;border:1px solid #273144;border-radius:8px;height:38px}
    .add{background:#1f2937;border:1px dashed #374151;border-radius:10px;padding:8px;text-align:center;cursor:pointer}
    .subrow{display:grid;grid-template-columns:42px 1fr;gap:8px;align-items:center;margin-top:6px}
  </style>
</head>
<body>
<header>
  <h1>Редактор cards.js <span class="muted">({{file_path}})</span></h1>
  <form method="post" action="/sync" style="margin-top:8px;display:flex;gap:8px;align-items:center">
    <input type="text" name="repo" placeholder="owner/repo" value="{{GITHUB_REPO}}" style="width:220px;background:#0b1220;color:#e6edf3;border:1px solid #273144;border-radius:8px;padding:6px"/>
    <input type="text" name="branch" placeholder="branch" value="{{GITHUB_BRANCH}}" style="width:120px;background:#0b1220;color:#e6edf3;border:1px solid #273144;border-radius:8px;padding:6px"/>
    <button class="btn" type="submit">⬇️ Скачать данные из GitHub</button>
    <a class="btn secondary" href="/reload">↻ Перезагрузка</a>
  </form>
  <div class="muted" style="margin-top:6px">По умолчанию: {{GITHUB_REPO}}@{{GITHUB_BRANCH}} → cards.js и /client/public/cataclysms</div>
</header>
<main>
  {% with msgs = get_flashed_messages() %}
    {% if msgs %}<div class="flash">{{ msgs[-1] }}</div>{% endif %}
  {% endwith %}

  <form method="post" id="form">
    <div class="card">
      <h3>Категории</h3>
      <div class="grid">
        {% for key in array_keys %}
          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <strong>{{ labels.get(key, key) }}</strong>
              <span class="muted" id="{{key}}_count">{{ arrays[key]|length }} шт.</span>
            </div>
            <div class="hr"></div>

            <div id="{{key}}_list">
              {% for v in arrays[key] %}
                <div class="row">
                  <div class="num">{{ loop.index }}</div>
                  <input type="text" name="{{key}}_item" value="{{v}}"/>
                </div>
              {% endfor %}
              <div class="row">
                <div class="num">{{ arrays[key]|length + 1 }}</div>
                <input type="text" name="{{key}}_item" placeholder="Новый элемент..."/>
              </div>
            </div>
            <div class="add" onclick="addItem('{{key}}')">+ Добавить ещё</div>
          </div>
        {% endfor %}
      </div>
    </div>

    <!-- ======= БУНКЕРЫ ======= -->
    <div class="card">
      <h3>Бункеры (BUNKERS)</h3>
      <div id="bunkers">
        {% for b in bunkers %}
        {% set i = loop.index0 %}
        <div class="card" data-index="{{i}}">
          <input type="hidden" name="bunk_idx" value="{{i}}"/>
          <div class="row" style="grid-template-columns:42px 1fr 160px 160px 120px 120px">
            <div class="num">{{ loop.index }}</div>
            <textarea name="bunk_desc_{{i}}" placeholder="Описание..." style="min-height:100px">{{b.description}}</textarea>
            <input type="number" name="bunk_size_{{i}}" value="{{b.sizeM2}}" placeholder="м²"/>
            <input type="text"   name="bunk_stay_{{i}}" value="{{b.stayText}}" placeholder="Время пребывания"/>
            <input type="text"   name="bunk_food_{{i}}" value="{{b.foodText}}" placeholder="Запас еды"/>
            <input type="number" name="bunk_places_{{i}}" value="{{b.places}}" placeholder="Мест"/>
          </div>
          <div class="muted" style="margin:6px 0 4px">Предметы:</div>
          <div id="bunk_items_{{i}}">
            {% for it in b['items'] %}
              <div class="subrow">
                <div class="num">{{ loop.index }}</div>
                <input type="text" name="bunk_item_{{i}}" value="{{it}}"/>
              </div>
            {% endfor %}
            <div class="subrow">
              <div class="num">{{ b['items']|length + 1 }}</div>
              <input type="text" name="bunk_item_{{i}}" placeholder="Новый предмет..."/>
            </div>
          </div>
          <div class="add" onclick="addBunkItem({{i}})">+ Добавить предмет</div>
        </div>
        {% endfor %}

        <!-- Пустая карточка для нового бункера -->
        {% set i = bunkers|length %}
        <div class="card" data-index="{{i}}">
          <input type="hidden" name="bunk_idx" value="{{i}}"/>
          <div class="row" style="grid-template-columns:42px 1fr 160px 160px 120px 120px">
            <div class="num">{{ i + 1 }}</div>
            <textarea name="bunk_desc_{{i}}" placeholder="Описание..." style="min-height:100px"></textarea>
            <input type="number" name="bunk_size_{{i}}" value="0" placeholder="м²"/>
            <input type="text"   name="bunk_stay_{{i}}" placeholder="Время пребывания"/>
            <input type="text"   name="bunk_food_{{i}}" placeholder="Запас еды"/>
            <input type="number" name="bunk_places_{{i}}" value="0" placeholder="Мест"/>
          </div>
          <div class="muted" style="margin:6px 0 4px">Предметы:</div>
          <div id="bunk_items_{{i}}">
            <div class="subrow">
              <div class="num">1</div>
              <input type="text" name="bunk_item_{{i}}" placeholder="Новый предмет..."/>
            </div>
          </div>
          <div class="add" onclick="addBunkItem({{i}})">+ Добавить предмет</div>
        </div>
      </div>
      <div class="add" onclick="addBunker()">+ Добавить бункер</div>
    </div>

    <!-- ======= КАТАКЛИЗМЫ ======= -->
    <div class="card">
      <h3>Катаклизмы (CATAclySMS)</h3>
      <div class="row muted" style="grid-template-columns:80px 180px 1fr 260px;font-weight:600;margin-bottom:6px">
        <div>#</div><div>ID</div><div>Заголовок</div><div>Описание</div><div>URL картинки</div>
      </div>
      <div id="cats">
        {% for c in cats %}
        <div class="row" style="grid-template-columns:42px 140px 180px 1fr 260px;margin-bottom:8px;align-items:start">
          <div class="num">{{ loop.index }}</div>
          <input type="text" name="cat_id" value="{{c.id}}"/>
          <input type="text" name="cat_title" value="{{c.title}}"/>
          <textarea name="cat_description" style="min-height:120px">{{c.description}}</textarea>
          <input type="text" name="cat_image" value="{{c.image}}"/>
        </div>
        {% endfor %}
        <div class="row" style="grid-template-columns:42px 140px 180px 1fr 260px;margin-bottom:8px;align-items:start">
          <div class="num">{{ cats|length + 1 }}</div>
          <input type="text" name="cat_id" placeholder="new-id"/>
          <input type="text" name="cat_title" placeholder="Заголовок"/>
          <textarea name="cat_description" placeholder="Описание..." style="min-height:120px"></textarea>
          <input type="text" name="cat_image" placeholder="/cataclysms/new.jpg"/>
        </div>
      </div>
      <div class="add" onclick="addCat()">+ Добавить катаклизм</div>
      <p class="muted">Совет: изображения храните в /client/public/cataclysms и указывайте путь вида <span class="pill">/cataclysms/file.jpg</span>.</p>
    </div>

    <div class="sticky-actions">
      <button class="btn" type="submit">💾 Сохранить изменения</button>
      <a class="btn secondary" href="" onclick="location.reload();return false;">↻ Отменить</a>
    </div>
  </form>
</main>

<script>
function addItem(key){
  const list = document.getElementById(key+'_list');
  const idx = list.querySelectorAll('input[name="'+key+'_item"]').length + 1;
  const wrap = document.createElement('div');
  wrap.className = 'row';
  wrap.innerHTML = '<div class="num">'+idx+'</div>' +
                   '<input type="text" name="'+key+'_item" placeholder="Новый элемент...">';
  list.appendChild(wrap);
  document.getElementById(key+'_count').textContent = (idx)+' шт.';
}
function addCat(){
  const cats = document.getElementById('cats');
  const idx = cats.querySelectorAll('input[name="cat_id"]').length + 1;
  const row = document.createElement('div');
  row.className = 'row';
  row.style = 'grid-template-columns:42px 140px 180px 1fr 260px;margin-bottom:8px;align-items:start';
  row.innerHTML = '<div class="num">'+idx+'</div>'+
    '<input type="text" name="cat_id" placeholder="new-id"/>'+
    '<input type="text" name="cat_title" placeholder="Заголовок"/>'+
    '<textarea name="cat_description" placeholder="Описание..." style="min-height:120px"></textarea>'+
    '<input type="text" name="cat_image" placeholder="/cataclysms/new.jpg"/>';
  cats.appendChild(row);
}
function addBunkItem(i){
  const list = document.getElementById('bunk_items_'+i);
  const idx = list.querySelectorAll('input[name="bunk_item_'+i+'"]').length + 1;
  const row = document.createElement('div');
  row.className = 'subrow';
  row.innerHTML = '<div class="num">'+idx+'</div>'+
                  '<input type="text" name="bunk_item_'+i+'" placeholder="Новый предмет...">';
  list.appendChild(row);
}
function addBunker(){
  const container = document.getElementById('bunkers');
  const i = container.querySelectorAll('div.card[data-index]').length;
  const el = document.createElement('div');
  el.className = 'card';
  el.setAttribute('data-index', i);
  el.innerHTML = `
    <input type="hidden" name="bunk_idx" value="${i}"/>
    <div class="row" style="grid-template-columns:42px 1fr 160px 160px 120px 120px">
      <div class="num">${i+1}</div>
      <textarea name="bunk_desc_${i}" placeholder="Описание..." style="min-height:100px"></textarea>
      <input type="number" name="bunk_size_${i}" value="0" placeholder="м²"/>
      <input type="text"   name="bunk_stay_${i}" placeholder="Время пребывания"/>
      <input type="text"   name="bunk_food_${i}" placeholder="Запас еды"/>
      <input type="number" name="bunk_places_${i}" value="0" placeholder="Мест"/>
    </div>
    <div class="muted" style="margin:6px 0 4px">Предметы:</div>
    <div id="bunk_items_${i}">
      <div class="subrow">
        <div class="num">1</div>
        <input type="text" name="bunk_item_${i}" placeholder="Новый предмет..."/>
      </div>
    </div>
    <div class="add" onclick="addBunkItem(${i})">+ Добавить предмет</div>
  `;
  container.appendChild(el);
}
</script>
</body>
</html>
"""
if __name__ == "__main__":
    print(f"Файл для редактирования: {FILE_PATH}")
    app.run(debug=True)
