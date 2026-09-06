"""Read-only aggregate contract used by HomeTools."""
from unittest.mock import patch


def test_admin_stats_requires_header_token(client, monkeypatch):
    monkeypatch.setenv('STATS_READ_TOKEN', 'stats-reader')
    for url in ('/api/admin/stats', '/api/admin/stats?token=stats-reader'):
        response = client.get(url)
        assert response.status_code == 401
        assert response.headers['Cache-Control'] == 'no-store'


def test_admin_stats_exports_aggregates_only(client, monkeypatch):
    from routes import stats
    monkeypatch.setenv('STATS_READ_TOKEN', 'stats-reader')
    with (patch.object(stats.cache_store, 'cache_hgetall', return_value={'json': 12}),
          patch.object(stats.cache_store, 'cache_get', return_value='42'),
          patch.object(stats, '_unique_visit_series', return_value=[{'date': '2026-09-05', 'users': 4}, {'date': '2026-09-06', 'users': 5}]),
          patch.object(stats, '_list_contents', return_value=['one', 'two']),
          patch.object(stats, '_load_content') as load_content,
          patch.object(stats.cache_store, 'cache_lrange') as history):
        response = client.get('/api/admin/stats', headers={'Authorization': 'Bearer stats-reader'})
    assert response.status_code == 200
    data = response.json['data']
    assert data['schemaVersion'] == 1 and data['source'] == 'devtools'
    assert {m['label']: m['value'] for m in data['metrics']}['近30日用户天次'] == 9
    assert len(data['dailyUsers']) == 2
    load_content.assert_not_called()
    history.assert_not_called()
    assert 'stats-reader' not in response.text


def test_unconfigured_export_is_closed(client, monkeypatch):
    monkeypatch.delenv('STATS_READ_TOKEN', raising=False)
    assert client.get('/api/admin/stats', headers={'Authorization': 'Bearer '}).status_code == 401
