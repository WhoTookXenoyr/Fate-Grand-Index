#!/usr/bin/env bash
# How the data jobs (.github/workflows/na-data.yml, upcoming.yml) hand in their work. 14 Nov 2026, after the security
# review: the jobs never push to main.
#
#   tools/bot_commit.sh BOT_BRANCH TITLE MESSAGE_FILE BODY_FILE PATH...
#
# - Run on main: commits PATH... to BOT_BRANCH, rebuilt on top of main (force-pushed, so a pull request left open
#   never falls behind), and opens a pull request from it into main, or updates the one that's open.
# - Run on any other branch: commits to that branch.
# Then it starts the test workflow on what it pushed: GitHub doesn't run workflows for pushes and pull requests a job
# makes with its own token, except when they're started this way (workflow_dispatch). Needs the permissions
# contents: write, pull-requests: write and actions: write, and GH_TOKEN set.
set -euo pipefail
bot="$1"; title="$2"; msg="$3"; body="$4"; shift 4

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -- "$@"
if git diff --cached --quiet; then
  echo "Nothing changed: nothing to commit." | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
fi

if [ "${GITHUB_REF_NAME}" != "main" ]; then
  git commit -q -F "$msg"
  git push -q origin "HEAD:${GITHUB_REF_NAME}"
  target="${GITHUB_REF_NAME}"
else
  git switch -q -c "$bot"
  git commit -q -F "$msg"
  git push -q -f origin "$bot"
  target="$bot"
  open=$(gh pr list --head "$bot" --base main --state open --json number --jq '.[0].number')
  if [ -n "$open" ]; then
    gh pr edit "$open" --title "$title" --body-file "$body"
  elif ! gh pr create --base main --head "$bot" --title "$title" --body-file "$body"; then
    m="The branch $bot is pushed, but GitHub didn't let this job open the pull request. Turn on Settings → Actions → General → Workflow permissions → \"Allow GitHub Actions to create and approve pull requests\", or open it by hand: https://github.com/${GITHUB_REPOSITORY}/compare/main...$bot"
    echo "::error::$m"; echo "$m" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; exit 1
  fi
fi

# the tests, on the commit just pushed (they show on its pull request)
if ! gh workflow run test.yml --ref "$target"; then
  echo "::warning::Couldn't start the tests on $target; run \"Build and test\" on it from the Actions tab."
fi
