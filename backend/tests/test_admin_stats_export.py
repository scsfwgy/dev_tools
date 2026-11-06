"""Read-only aggregate contract used by HomeTools."""
from unittest.mock import patch


def test_admin_stats_requires_header_token(client, monkeypatch):
    monkeypatch.setenv('STATS_READ_TOKEN', 'stats-reader')
    for url in ('/api/admin/stats', '/api/admin/stats?token=stats-reader'):
        response = client.get(url)
        assert response.status_code == 401
        assert response.headers['Cache-Control'] == 'no-store'


def test_admin_stats_exports_aggregates_and_records_without_ip(client, monkeypatch):
    from routes import stats
    monkeypatch.setenv('STATS_READ_TOKEN', 'stats-reader')
    with (patch.object(stats.cache_store, 'cache_hgetall', return_value={'json': 12}),
          patch.object(stats.cache_store, 'cache_get', return_value='42'),
          patch.object(stats, '_unique_visit_series', return_value=[{'date': '2026-09-05', 'users': 4}, {'date': '2026-09-06', 'users': 5}]),
          patch.object(stats, '_list_contents', return_value=['one', 'two']),
          patch.object(stats, '_load_content', return_value={'text': 'shared text', 'size': 11, 'ip': 'private-ip'}) as load_content,
          patch.object(stats.cache_store, 'cache_lrange', return_value=['{"dir":"en-zh","src":"hello","tgt":"你好"}']) as history):
        response = client.get('/api/admin/stats', headers={'Authorization': 'Bearer stats-reader'})
    assert response.status_code == 200
    data = response.json['data']
    assert data['schemaVersion'] == 1 and data['source'] == 'devtools'
    assert {m['label']: m['value'] for m in data['metrics']}['近30日用户天次'] == 9
    assert len(data['dailyUsers']) == 2
    assert load_content.call_count == 2
    assert history.call_count == 2
    assert data['records'][0]['rows'][0] == ['en-zh', 'hello', '你好']
    assert 'shared text' in response.text
    assert 'private-ip' not in response.text
    assert 'stats-reader' not in response.text


def test_admin_stats_counts_a_new_daily_visitor_by_country_once(client, monkeypatch):
    monkeypatch.setenv('STATS_READ_TOKEN', 'stats-reader')
    uid = '11111111-1111-4111-8111-111111111111'
    assert client.post('/api/visits/increment', json={'anonymous_id': uid},
                       headers={'X-Vercel-IP-Country': 'sg'}).status_code == 200
    assert client.post('/api/visits/increment', json={'anonymous_id': uid},
                       headers={'X-Vercel-IP-Country': 'US'}).status_code == 200
    data = client.get('/api/admin/stats', headers={'Authorization': 'Bearer stats-reader'}).json['data']
    assert data['geo']['day'] == [{'code': 'SG', 'value': 1}]
    assert data['geo']['labels']['week'] == '近 7 日用户天次'
    assert uid not in client.get('/api/admin/stats', headers={'Authorization': 'Bearer stats-reader'}).text


def test_unconfigured_export_is_closed(client, monkeypatch):
    monkeypatch.delenv('STATS_READ_TOKEN', raising=False)
    assert client.get('/api/admin/stats', headers={'Authorization': 'Bearer '}).status_code == 401


def test_content_export_batches_reads_and_reports_unavailable(client, monkeypatch):
    from routes import stats
    monkeypatch.setenv('STATS_READ_TOKEN', 'stats-reader')
    with (patch.object(stats.cache_store, 'is_enabled', return_value=True),
          patch.object(stats.cache_store, 'cache_hgetall', return_value={}),
          patch.object(stats.cache_store, 'cache_get', return_value='0'),
          patch.object(stats.cache_store, 'cache_lrange', return_value=[]),
          patch.object(stats, '_list_contents', return_value=['one', 'two']),
          patch.object(stats.cache_store, 'cache_mget', return_value=['{"text":"example","ip":"private"}', None]) as batch):
        response = client.get('/api/admin/stats', headers={'Authorization': 'Bearer stats-reader'})
        assert response.status_code == 200
        assert batch.call_count == 1
        assert len(batch.call_args.args[0]) == 2
        assert 'private' not in response.text
        batch.return_value = None
        assert client.get('/api/admin/stats', headers={'Authorization': 'Bearer stats-reader'}).status_code == 503
