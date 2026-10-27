#!/usr/bin/env python3
"""Read-only verification using the installed Online server's credentials.

No credentials or check records are printed or written. identity-map is an
optional root-private JSON object mapping a verified Online UUID to its exact
administrator-confirmed Live profile UUID (for different verified emails).
"""
import argparse
import json
import subprocess
import urllib.request
from collections import Counter

ap = argparse.ArgumentParser()
ap.add_argument('plan_id')
ap.add_argument('--identity-map')
args = ap.parse_args()
c = json.loads(subprocess.check_output(['docker', 'inspect', 'fets-tv-fets-tv-1']))[0]
env = dict(v.split('=', 1) for v in c['Config']['Env'])
lu = env['FETS_LIVE_SUPABASE_URL'].rstrip('/')
ou = env['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')
assert lu == 'https://qqewusetilxxfvfkmsed.supabase.co'
assert ou == 'https://ueufcqmdqtwvhjjyudeu.supabase.co'
lk = env['FETS_LIVE_SUPABASE_KEY']
ok = env['SUPABASE_SERVICE_ROLE_KEY']


def request(url, key, body=None):
    headers = {'apikey': key, 'Content-Type': 'application/json'}
    if key.startswith('eyJ'):
        headers['Authorization'] = 'Bearer ' + key
    data = None if body is None else json.dumps(body).encode()
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers, data=data), timeout=30) as response:
        return json.load(response)


def users(url, key):
    result = []
    page = 1
    while True:
        batch = request(url + '/auth/v1/admin/users?per_page=100&page=' + str(page), key)['users']
        result.extend(batch)
        if len(batch) < 100:
            return result
        page += 1


plan = request(lu + '/rest/v1/shift_days_v2?id=eq.' + args.plan_id + '&select=*', lk)[0]
assert plan['status'] == 'published'
assert plan['published_at']
profiles = request(ou + '/rest/v1/profiles?select=id,role,center_id,centers(name,active)', ok)
online_users = users(ou, ok)
live_users = {u['id']: u for u in users(lu, lk)}
staff = {s['id']: s for s in request(lu + '/rest/v1/staff_profiles?select=id,user_id', lk)}
links = json.load(open(args.identity_map)) if args.identity_map else {}
canonical = None
viewers = []
for person in plan['plan']['people']:
    live_account = live_users[staff[person['id']]['user_id']]
    linked_ids = [k for k, v in links.items() if v == person['id']]
    candidates = [u for u in online_users if (u['id'] in linked_ids if linked_ids else u.get('email', '').lower() == live_account['email'].lower())]
    assert len(candidates) == 1, 'Missing or ambiguous confirmed Online identity'
    user = candidates[0]
    assert user.get('email_confirmed_at')
    profile = next(p for p in profiles if p['id'] == user['id'])
    assert profile['role'] in ('admin', 'tca', 'front_office', 'lab_staff')
    assert profile['centers']['active']
    branch = 'cochin' if any(x in profile['centers']['name'].lower() for x in ('cochin', 'kochi')) else 'calicut'
    assert branch == plan['branch']
    # This is a read-only RPC, reached with the actual installed server key and
    # the verified account/centre context used by the authenticated API route.
    snapshot = request(lu + '/rest/v1/rpc/fets_online_shift_snapshot_v2', lk, {
        'p_online_user': user['id'], 'p_email': user['email'],
        'p_branch': branch, 'p_day': plan['day'],
    })
    assert snapshot['plan']['id'] == plan['id']
    assert snapshot['plan']['format'] == 2
    assert snapshot['plan']['tracking_from'] == plan['published_at']
    assert snapshot['viewer_id'] == person['id']
    assert snapshot['viewer_rostered']
    if canonical is None:
        canonical = snapshot['checks']
    assert snapshot['checks'] == canonical
    viewers.append({'name': person['name'], 'verified_identity': True, 'temporary_cover': bool(person.get('support'))})

# Independently derive every slot/owner from the published plan and compare
# the canonical Online snapshot, especially all changeovers and break cover.
p = plan['plan']
expected = []
for window, monitoring in enumerate(p['monitoring']):
    for kind, step in [('walk', 10), ('dvr', 6)]:
        for due in range(monitoring['start'] + step, monitoring['end'] + 1, step):
            owners = [b['staff'] for b in p['blocks'] if 'monitor' in b['duties'] and b['start'] <= due - 1 < b['end']]
            assert len(owners) == 1
            expected.append((window, kind, due, owners[0]))
actual = [(c['block'], c['kind'], c['due'], c['owner_id']) for c in canonical]
assert sorted(actual) == sorted(expected)
for block in [b for b in p['blocks'] if 'break' in b['duties']]:
    cover = [c for c in canonical if block['start'] < c['due'] <= block['end']]
    assert cover and all(c['owner_id'] == block['cover'] for c in cover)
result = {
    'day': plan['day'], 'branch': plan['branch'], 'format': 2,
    'published': True, 'tracking_from': plan['published_at'], 'viewers': viewers,
    'shared_checks': len(canonical), 'kinds': dict(Counter(c['kind'] for c in canonical)),
    'all_changeovers_and_breaks_match': True,
    'existing_records': sum(bool(c['event']) for c in canonical),
    'verification_created_records': 0,
}
print(json.dumps(result))
