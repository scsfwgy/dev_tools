"""Bounded AI narration: canonical locations in, plain text out, no state mutations."""
import hashlib
import json
import logging
import threading
import time
from collections import OrderedDict
from functools import lru_cache
from datetime import datetime, timezone

import requests
import app_settings
from service import cache_store

logger = logging.getLogger(__name__)
_CACHE = OrderedDict()
_RATES = OrderedDict()
_LOCK = threading.Lock()


@lru_cache(maxsize=2)
def _text(lang):
    return json.loads((app_settings.FRONTEND_DIR / 'locales' / ('en.json' if lang == 'en' else 'zh-CN.json')).read_text())['lifeSim']


def clean_context(value, lang):
    if not isinstance(value, dict):
        return None
    age = value.get('age')
    if type(age) is not int or not 0 <= age <= 100 or not isinstance(value.get('event'),str) or value.get('event') not in _text(lang)['events']:
        return None
    enums = {'job': ['none','entry','skilled','professional','retired','unemployed'],
             'education': ['none','work','university','vocational'],
             'wealth': ['poor','ordinary','comfortable','wealthy'],
             'health': ['well','unwell','critical']}
    result = {'age': age, 'event': value['event']}
    for key, options in enums.items():
        if value.get(key) not in options:
            return None
        result[key] = value[key]
    roles = value.get('roles', [])
    if not isinstance(roles, list) or len(roles) > 16 or any(not isinstance(r,str) or r not in _text(lang)['roles'] for r in roles):
        return None
    result['roles'] = sorted(set(roles))
    return result


def _cached(key):
    with _LOCK:
        item = _CACHE.get(key)
        if item and item[1] > time.time():
            _CACHE.move_to_end(key)
            return item[0]
        _CACHE.pop(key, None)
    value = cache_store.cache_get(key)
    if value:
        try:
            result = json.loads(value)
            if _valid(result):
                return result
        except (ValueError, TypeError):
            pass
    return None


def _valid(value):
    return isinstance(value, dict) and all(isinstance(value.get(k), str) and 0 < len(value[k].strip()) <= n for k,n in [('title',100),('body',5000)])


def _country_valid(value):
    return isinstance(value,dict) and all(isinstance(value.get(k),str) and 0 < len(value[k].strip()) <= 1200 for k in ('economy','ranking','environment','tourism'))


def _allowed(ip):
    key = 'life_ai_rate:' + hashlib.sha256(ip.encode()).hexdigest()[:24]
    if cache_store.is_enabled():
        count = cache_store.cache_incr(key)
        if count == 1:
            cache_store.cache_expire(key, 60)
        return count is not None and count <= 20
    now = time.time()
    with _LOCK:
        hits = [t for t in _RATES.get(key, []) if now-t < 60]
        if len(hits) >= 20:
            return False
        _RATES[key] = hits + [now]
        _RATES.move_to_end(key)
        while len(_RATES) > 1024:
            _RATES.popitem(last=False)
        return True


def generate(kind, location, lang, context, ip):
    if not app_settings._DEEPSEEK_KEY:
        return None, 'not_configured', 503
    payload = {'kind': kind, 'location': location['id'], 'lang': lang, 'context': context}
    key = 'life_ai:v2:' + hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()
    cached = _cached(key)
    if cached and (_country_valid(cached.get('country')) if kind == 'intro' else len(cached['body']) <= 1200):
        return cached, None, 200
    if not _allowed(ip):
        return None, 'rate_limited', 429
    language = 'English' if lang == 'en' else '简体中文'
    place = location['pathEn'] if lang == 'en' else location['path']
    system = ('You write for a fictional life-observation game. Return only a JSON object with title and body strings, plus a country object when requested. '
              'No HTML, commands or markdown fences. Never invent precise local statistics, wages, medical advice or future real-world events. '
              'The dataset locality may be a state/province rather than a city. Acknowledge uncertainty. Write in ' + language + '.')
    if kind == 'intro':
        prompt = ('Create a birthplace welcome guide for '+place+'. Current reference year: '+str(datetime.now(timezone.utc).year)+'. '
                  'Return JSON with title, body and country:{economy,ranking,environment,tourism}; every field is a plain text string. '
                  'body: 350-600 Chinese characters or 200 English words about everyday local life: climate, housing, transport, food, education, work and public services. '
                  'country.economy: national industries, living standards, inequality and how economic conditions vary between regions. '
                  'country.ranking: explain the country’s global economic/development position. Every numerical ranking MUST identify the metric (total GDP, GDP per capita, HDI etc), year and a known source (World Bank, IMF, UNDP etc). '
                  'DO NOT invent a rank, statistic, year or source, or claim a current 2026 ranking without reliable knowledge. If uncertain, explicitly say no reliable ranking is available; give qualitative context instead. '
                  'country.environment: national landscape, climate and environmental conditions; do not imply uniform quality everywhere. '
                  'country.tourism: cultural and natural attractions, regional differences, ordinary travel considerations; no current visa rules or claims of guaranteed safety. '
                  'Each country field: 80-160 Chinese characters or 60-90 English words. Make national context distinct from local life. '
                  'Provide educational context, not travel advertising or investment advice. No fabricated precise wages/prices/eligibility claims. '
                  'Respect the dataset locality level. Clearly distinguish known background from uncertainty. Write in '+language+'.')
    else:
        event = _text(lang)['events'][context['event']]
        prompt = 'Expand this already determined fictional event at ' + place + '. Facts: ' + json.dumps(context,ensure_ascii=False)
        prompt += '\nEvent: ' + event['title'] + '\n' + event['body']
        prompt += ('\nWrite an immersive scene (100-220 Chinese characters or 90 English words) in second person. '
                   'Do not ask the reader to choose. Do not introduce new named people, deaths, jobs, marriages, children, relocations or financial results '
                   'beyond these facts. Do not change the event or claim a recovery. Refer to relatives by role only. '
                   'Describe the present scene, not a future decision or result. Education, love and family milestones do not imply '
                   'enrollment, marriage or a new child has happened. Only roles in the list are living; do not identify an unspecified deceased person.')
    try:
        response = requests.post(app_settings._DEEPSEEK_URL,
            headers={'Authorization': 'Bearer ' + app_settings._DEEPSEEK_KEY, 'Content-Type':'application/json'},
            json={'model':'deepseek-v4-flash','messages':[{'role':'system','content':system},{'role':'user','content':prompt}],
                  'temperature': .7, 'max_tokens': 4000 if kind == 'intro' else 1400}, timeout=(3,30 if kind == 'intro' else 18))
        response.raise_for_status()
        choice = response.json()['choices'][0]
        if choice.get('finish_reason') == 'length':
            return None, 'generation_incomplete', 502
        result = json.loads(choice['message']['content'])
        if not _valid(result) or (kind == 'intro' and not _country_valid(result.get('country'))) or (kind == 'event' and len(result['body']) > 1200):
            raise ValueError('invalid_response')
        country = {k:result['country'][k].strip() for k in ('economy','ranking','environment','tourism')} if kind == 'intro' else None
        result = {k:result[k].strip() for k in ['title','body']}
        if country is not None:
            result['country']=country
    except (requests.RequestException, ValueError, KeyError, TypeError, IndexError) as error:
        logger.info('event=life_ai_fallback kind=%s error_type=%s',kind,type(error).__name__)
        return None, 'generation_failed', 502
    with _LOCK:
        _CACHE[key] = (result,time.time()+86400)
        while len(_CACHE) > 256:
            _CACHE.popitem(last=False)
    cache_store.cache_set(key,json.dumps(result,ensure_ascii=False),86400)
    logger.info('event=life_ai_success kind=%s chars=%s',kind,len(result['body']))
    return result, None, 200
