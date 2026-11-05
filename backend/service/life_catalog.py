"""Life-game adapter over the same catalog used by Area Search."""
import math
import random
import re
from functools import lru_cache

from service.area_data import _load_world_countries, _load_china_tree, _resolve_area_path


def _coordinate(value, bound):
    try:
        value = float(value)
        return value if math.isfinite(value) and abs(value) <= bound else None
    except (ValueError, TypeError):
        return None


@lru_cache(maxsize=1)
def countries():
    result = {}
    for item in _load_world_countries():
        code = str(item['code']).upper()
        if re.fullmatch(r'[A-Z]{3}', code) and (item.get('name') or item.get('cname')):
            result.setdefault(code, item)
    return result


def _world_places(country):
    seen = set()
    result = []
    for city in country.get('cities') or []:
        code = str(city.get('code') or '')
        # Known wrong-country label in the source; do not change Area Search's original data.
        if (country['code'], code) == ('USA', 'STP'):
            continue
        if not code or code in seen or not (city.get('name') or city.get('cname')):
            continue
        seen.add(code)
        result.append([country['code'], code])
    return result or [[country['code']]]


@lru_cache(maxsize=1)
def _china_places():
    result = []
    for pc, province in _load_china_tree().items():
        for cc, city in (province.get('c') or {}).items():
            for dc in city.get('c') or {}:
                result.append([pc, cc, dc])
            if not city.get('c'):
                result.append([pc, cc])
    return result


def resolve(spec):
    if not isinstance(spec, dict):
        return None
    legacy = spec.get('legacy')
    aliases = {'changsha': ('china', ['43', '4301']), 'shaoyang': ('china', ['43', '4305']),
               'osaka': ('world', ['JPN', '27']), 'nagano': ('world', ['JPN', '20']),
               'saopaulo': ('world', ['BRA', 'SP']), 'recife': ('world', ['BRA', 'PE'])}
    if isinstance(legacy,str) and legacy in aliases:
        mode, codes = aliases[legacy]
    else:
        mode, codes = spec.get('mode'), spec.get('codes')
    if mode not in ('china', 'world') or not isinstance(codes, list) or not 1 <= len(codes) <= 3:
        return None
    if not all(isinstance(c, str) and 0 < len(c) <= 20 for c in codes):
        return None
    codes = [c.strip() for c in codes]
    if mode == 'world' and len(codes) > 2:
        return None
    path = _resolve_area_path(mode, codes)
    if not path:
        return None
    country = countries().get('CHN' if mode == 'china' else codes[0].upper())
    if not country:
        return None
    if mode == 'china':
        # Canonical ancestors come from the final code, never caller-provided place names.
        code = codes[-1]
        codes = [code[:2]] + ([code[:4]] if len(code) >= 4 else []) + ([code] if len(code) == 6 else [])
        names = path.split(' ')
        path_en = country.get('name', 'China') + ' / ' + ' / '.join(names)
        path = '中国 / ' + ' / '.join(names)
        level = 'district' if len(code) == 6 else 'locality'
    else:
        codes[0] = country['code']
        city = next((c for c in country.get('cities') or [] if str(c.get('code')) == codes[-1]), None) if len(codes) > 1 else None
        path_en = (country.get('name') or country.get('cname')) + ((' / ' + (city.get('name') or city.get('cname'))) if city else '')
        path = ' / '.join([country.get('cname') or country.get('name')] + ([city.get('cname') or city.get('name')] if city else []))
        level = 'locality' if city else 'country'
    return {'id': mode + ':' + ':'.join(codes), 'mode': mode, 'codes': codes,
            'country': country['code'], 'path': path, 'pathEn': path_en, 'level': level,
            'lat': _coordinate(country.get('latitude'), 90), 'lon': _coordinate(country.get('longitude'), 180),
            'precision': 'country'}


def birth(seed):
    rng = random.Random(seed)
    country = rng.choice(list(countries().values()))
    options = _china_places() if country['code'] == 'CHN' else _world_places(country)
    mode = 'china' if country['code'] == 'CHN' else 'world'
    selected = rng.sample(options, min(2, len(options)))
    places = [resolve({'mode': mode, 'codes': codes}) for codes in selected]
    places = [p for p in places if p]
    if not places:
        places = [resolve({'mode': 'world', 'codes': [country['code']]})]
    return {'country': {'code': country['code'], 'name': country.get('name') or country.get('cname'),
                        'cname': country.get('cname') or country.get('name')},
            'places': places, 'origin': places[0]['id']}
