"""Deploy only Island Town co-op rules using the current gcloud login."""
import json
from pathlib import Path
import subprocess
import urllib.request

PROJECT = 'island-town-coop-20261011'
token = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True).strip()
base = 'https://firebaserules.googleapis.com/v1/projects/' + PROJECT

def call(url, method='GET', data=None):
    request = urllib.request.Request(url, method=method,
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT},
        data=json.dumps(data).encode() if data is not None else None)
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)

source = Path(__file__).with_name('firestore.rules').read_text()
ruleset = call(base + '/rulesets', 'POST', {'source': {'files': [{'name': 'firestore.rules', 'content': source}]}})['name']
release = {'name': 'projects/' + PROJECT + '/releases/cloud.firestore', 'rulesetName': ruleset}
existing = call(base + '/releases').get('releases', [])
result = (call(base + '/releases/cloud.firestore', 'PATCH', {'release': release})
          if any(item['name'] == release['name'] for item in existing)
          else call(base + '/releases', 'POST', release))
print(json.dumps({'project': PROJECT, 'ruleset': ruleset, 'release': result['name'], 'updatedAt': result.get('updateTime')}))
