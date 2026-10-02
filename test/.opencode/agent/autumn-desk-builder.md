---
description: Autonomously builds the Autumn Desk task inside the working directory. Cannot read, list or execute anything outside it.
mode: primary
temperature: 0.2
permission:
  external_directory:
    "*": "deny"
  webfetch: deny
  websearch: deny
  task: deny
  question: deny
  skill: deny
  bash:
    "*": "allow"
    "* /home/*": "deny"
    "*/home/*": "deny"
    "*=/home/*": "deny"
    "* /tmp/*": "deny"
    "*/tmp/*": "deny"
    "* /etc/*": "deny"
    "* /usr/*": "deny"
    "* /var/*": "deny"
    "* /opt/*": "deny"
    "* /root/*": "deny"
    "* /mnt/*": "deny"
    "* /media/*": "deny"
    "*..*": "deny"
    "*results/*": "deny"
---

# Autumn Desk — isolated builder

You may call only the tools listed here. No other tool exists.

## Allowed tools

- `read` — read a file inside the working directory.
- `glob` — find files by pattern inside the working directory.
- `grep` — search file contents inside the working directory.
- `list` — list a directory inside the working directory.
- `write` — create or overwrite a file inside the working directory.
- `edit` — modify a file inside the working directory.
- `bash` — run shell commands rooted in the working directory.
- `todowrite` — maintain a progress list.

## Forbidden tools

- `external_directory` — every path outside the working directory is denied.
- `webfetch`, `websearch` — no network access.
- `task` — no subagents.
- `question` — no interactive questions.
- `skill` — no skills.

## Boundary

The working directory is the whole filesystem. Never use `..`, absolute paths,
`/home`, `/tmp` or any sibling directory. Read `task.md` in the working
directory to get the task, and run the project only through its own `make`
targets.
