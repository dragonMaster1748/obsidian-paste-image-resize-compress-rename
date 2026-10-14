"""Retain five successful install/source ZIP artifacts in this repository."""
import fnmatch
import json
import os
import sys
import urllib.error
import urllib.request

WORKFLOW_PATHS = [".github/workflows/build-zip.yml"]
ARTIFACT_PATTERNS = ["paste-image-resize-compress-rename-*"]


def deletion_candidates(artifacts, runs):
    eligible = [a for a in artifacts if
                any(fnmatch.fnmatchcase(a['name'], p) for p in ARTIFACT_PATTERNS)
                and runs[a['workflow_run']['id']].get('path', '').split('@')[0] in WORKFLOW_PATHS
                and runs[a['workflow_run']['id']]['status'] == 'completed']
    successful = sorted((a for a in eligible if not a['expired']
                         and runs[a['workflow_run']['id']]['conclusion'] == 'success'),
                        key=lambda a: (a['created_at'], a['id']), reverse=True)
    keep = {a['id'] for a in successful[:5]}
    return [a for a in eligible if a['id'] not in keep]


def self_test():
    name = ARTIFACT_PATTERNS[0].replace('*', 'test')
    artifacts = [{'id': i, 'name': name, 'expired': False,
                  'created_at': str(i).zfill(2), 'workflow_run': {'id': i}}
                 for i in range(1, 11)]
    runs = {i: {'path': WORKFLOW_PATHS[0], 'status': 'completed', 'conclusion': 'success'}
            for i in range(1, 11)}
    runs[8]['conclusion'] = 'failure'
    runs[9]['status'] = 'in_progress'
    runs[10]['path'] = '.github/workflows/unrelated.yml'
    assert {a['id'] for a in deletion_candidates(artifacts, runs)} == {1, 2, 8}
    artifacts[6]['expired'] = True
    runs[9].update(status='completed', conclusion='cancelled')
    assert {a['id'] for a in deletion_candidates(artifacts, runs)} == {1, 7, 8, 9}
    assert not deletion_candidates(artifacts[:3], runs)
    print('Retention selection passed: five newest, expired, failed, cancelled, active and unrelated runs.')


def main():
    base = os.environ['GITHUB_API_URL'] + '/repos/' + os.environ['GITHUB_REPOSITORY']
    headers = {'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
               'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}

    def request(path, method='GET'):
        try:
            with urllib.request.urlopen(urllib.request.Request(base + path, headers=headers, method=method), timeout=60) as response:
                body = response.read()
                return json.loads(body) if body else None
        except urllib.error.HTTPError as error:
            if method == 'DELETE' and error.code == 404:
                return None
            raise

    artifacts, page = [], 1
    while True:
        batch = request(f'/actions/artifacts?per_page=100&page={page}')['artifacts']
        artifacts.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    candidates = [a for a in artifacts if a.get('workflow_run', {}).get('id')
                  and any(fnmatch.fnmatchcase(a['name'], p) for p in ARTIFACT_PATTERNS)]
    # Complete all reads before deleting; an API error must not cause partial selection.
    runs = {run_id: request(f'/actions/runs/{run_id}')
            for run_id in sorted({a['workflow_run']['id'] for a in candidates})}
    obsolete = deletion_candidates(candidates, runs)
    for artifact in obsolete:
        request(f"/actions/artifacts/{artifact['id']}", 'DELETE')
        print(f"Deleted {artifact['id']}: {artifact['name']}")
    summary = (f"Deleted {len(obsolete)} obsolete/unsuccessful ZIP artifacts "
               f"({sum(a['size_in_bytes'] for a in obsolete) / 1024**2:.1f} MiB). "
               "Kept the five newest available successful ZIPs; active and unrelated runs untouched.")
    print(summary)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as report:
            report.write(summary + '\n')


if __name__ == '__main__':
    self_test() if '--self-test' in sys.argv else main()
