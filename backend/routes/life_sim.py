"""Canonical birth locations, AI chapters and local guides for the portable life game."""
from flask import Blueprint, jsonify, request
import app_settings
from http_utils import _client_ip
from service import life_catalog, life_ai

life_sim_bp = Blueprint('life_sim',__name__,url_prefix='/api/life-sim')


@life_sim_bp.get('/birth')
def birth():
    try:
        seed = int(request.args.get('seed',''))
        if not 0 <= seed <= 4294967295:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify(ok=False,error='invalid_seed'),400
    country = request.args.get('country', '').strip().upper()
    place = request.args.get('place', '').strip()
    if len(country) > 3 or len(place) > 100:
        return jsonify(ok=False,error='invalid_selection'),400
    try:
        world = life_catalog.birth(seed, country or None, place or None)
    except ValueError as error:
        return jsonify(ok=False,error=str(error)),400
    return jsonify(ok=True,data=world,countries=len(life_catalog.countries()))


@life_sim_bp.get('/locations')
def locations():
    code = request.args.get('country', '').strip().upper()
    if not code:
        return jsonify(ok=True,data=[{'code':c['code'],'name':c.get('name') or c.get('cname'),
                                     'cname':c.get('cname') or c.get('name')}
                                    for c in life_catalog.countries().values()])
    if code not in life_catalog.countries():
        return jsonify(ok=False,error='invalid_country'),400
    return jsonify(ok=True,data=life_catalog.selectable_places(code))


@life_sim_bp.post('/ai')
def ai():
    if request.content_length and request.content_length > 8192:
        return jsonify(ok=False,error='too_large'),413
    value = request.get_json(silent=True)
    if not isinstance(value,dict) or value.get('kind') not in ('intro','event') or value.get('lang') not in ('zh','en'):
        return jsonify(ok=False,error='invalid_request'),400
    location = life_catalog.resolve(value.get('location'))
    if not location:
        return jsonify(ok=False,error='invalid_region'),400
    context = life_ai.clean_context(value.get('context'),value['lang']) if value['kind']=='event' else None
    if value['kind']=='event' and context is None:
        return jsonify(ok=False,error='invalid_context'),400
    result,error,status = life_ai.generate(value['kind'],location,value['lang'],context,_client_ip())
    response = jsonify(ok=not error,data=result,error=error)
    if status == 429:
        response.headers['Retry-After'] = '60'
    return response,status


@life_sim_bp.post('/chapter')
def chapter():
    from service import life_chapters
    if request.content_length and request.content_length > 32768:
        return jsonify(ok=False,error='too_large'),413
    value=request.get_json(silent=True)
    parsed=life_chapters.clean_request(value)
    if parsed is None:
        return jsonify(ok=False,error='invalid_request'),400
    specs=value.get('places')
    if not isinstance(specs,list) or not 1<=len(specs)<=2:
        return jsonify(ok=False,error='invalid_region'),400
    places=[life_catalog.resolve(spec) for spec in specs]
    if any(p is None for p in places) or len({p['country'] for p in places})!=1 or len({p['id'] for p in places})!=len(places):
        return jsonify(ok=False,error='invalid_region'),400
    current=parsed['context']
    index=current['locationIndex'] if current else 0
    if index>=len(places):
        return jsonify(ok=False,error='invalid_region'),400
    result,error,status=life_chapters.generate(value,places[index],places,_client_ip())
    response=jsonify(ok=not error,data=result,error=error)
    if status==429:
        response.headers['Retry-After']='60'
    return response,status
