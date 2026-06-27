#!/usr/bin/env bash
# transition.sh — move a board ticket to a new status
# Usage: ./scripts/transition.sh <issue-number> <status>
# Statuses: Todo, Planning, "In Progress", "In Review", Done

set -euo pipefail

ISSUE="$1"
STATUS="$2"
PROJECT_NUMBER=2
OWNER="pateketrueke"

# Resolve the single-select option ID for the target status
OPTION_ID=$(gh api graphql -f query='
query($owner: String!, $number: Int!) {
  user(login: $owner) {
    projectV2(number: $number) {
      field(name: "Status") {
        ... on ProjectV2SingleSelectField {
          options { id name }
        }
      }
    }
  }
}' -F owner="$OWNER" -F number="$PROJECT_NUMBER" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
options = data['data']['user']['projectV2']['field']['options']
status = '$STATUS'
match = [o for o in options if o['name'].lower() == status.lower()]
if not match:
    print(f'ERROR: Unknown status: {status}', file=sys.stderr)
    sys.exit(1)
print(match[0]['id'])
")

# Find the project item ID for this issue
ITEM_ID=$(gh api graphql -f query='
query($owner: String!, $number: Int!) {
  user(login: $owner) {
    projectV2(number: $number) {
      items(first: 100) {
        nodes {
          id
          content {
            ... on Issue { number }
          }
        }
      }
    }
  }
}' -F owner="$OWNER" -F number="$PROJECT_NUMBER" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
items = data['data']['user']['projectV2']['items']['nodes']
match = [i for i in items if i.get('content', {}).get('number') == $ISSUE]
if not match:
    print(f'ERROR: Issue #$ISSUE not found on board', file=sys.stderr)
    sys.exit(1)
print(match[0]['id'])
")

# Get the field ID
FIELD_ID=$(gh api graphql -f query='
query($owner: String!, $number: Int!) {
  user(login: $owner) {
    projectV2(number: $number) {
      field(name: "Status") {
        ... on ProjectV2SingleSelectField { id }
      }
    }
  }
}' -F owner="$OWNER" -F number="$PROJECT_NUMBER" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['user']['projectV2']['field']['id'])")

# Transition the ticket
gh api graphql -f query='
mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $project
    itemId: $item
    fieldId: $field
    value: { singleSelectOptionId: $option }
  }) {
    projectV2Item { id }
  }
}' -F project="PVT_kwHOAAMmI84Bbx3K" -F item="$ITEM_ID" -F field="$FIELD_ID" -F option="$OPTION_ID" > /dev/null

echo "Issue #$ISSUE → $STATUS"
