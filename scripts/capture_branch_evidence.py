#!/usr/bin/env python3
"""Capture fetched branch/author evidence without inferring ownership, hours or acceptance."""
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def main():
    rows = []
    for line in git("for-each-ref", "--format=%(refname:short)|%(objectname)", "refs/heads", "refs/remotes/origin").splitlines():
        ref, sha = line.split("|", 1)
        if ref == "origin/HEAD":
            continue
        commits = []
        for item in git("log", "--no-merges", "-8", "--format=%H|%aI|%an|%s", ref).splitlines():
            value, date, author, subject = item.split("|", 3)
            commits.append({"sha": value, "author_date": date, "author": author, "subject": subject})
        rows.append({"ref": ref, "tip": sha, "recent_original_commits": commits,
                     "commits_not_on_origin_main": int(git("rev-list", "--count", "origin/main.." + ref))})
    data = {"captured_at_utc": datetime.now(timezone.utc).isoformat(), "origin_main": git("rev-parse", "origin/main"),
            "scope": "Only local and fetched origin refs visible to this clone. Does not inspect teammates' unpushed work or prove instructor acceptance. Dates and counts are not work hours.", "branches": rows}
    out = ROOT / "docs/quality/branch-evidence.json"
    out.write_text(json.dumps(data, indent=2) + "\n")
    print(out)


if __name__ == "__main__":main()
