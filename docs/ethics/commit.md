# Flashcards - Before You Commit

## IMPORTANT!!!
  ### DOs
    - Commit from WSL Debian. Staging, diffing and the commit itself.
    - Tests green first. Say how many.
    - Stage on purpose, path by path. `git add -A` is banned.
    - Conventional commit: `type: summary`, then a body saying what and why.

  ### Prove It
    - `git status` shows nothing unexpected.
    - `git diff --cached` read line by line.
    - The build and the tests pass in WSL Debian.
    - Staged blobs carry LF, never CRLF.
    - The cleanup gate is done: no server, debug browser, log, cache or scratch file from this job remains.

## DO NOTs
    - **DO NOT COMMIT FROM WINDOWS GIT** - it rewrites line endings and will not agree with WSL git about what changed.
    - **DO NOT COMMIT FAILING TESTS** - a red suite is a blocker, not a note.
    - **DO NOT COMMIT SECRETS** - no keys, tokens or passwords, ever.
    - **DO NOT COMMIT CRLF** - `.gitattributes` pins `* text=auto eol=lf`. A diff that rewrites every line for no reason is line-ending noise: reject it and revert the file.
    - **DO NOT COMMIT WHAT GIT IGNORES SILENTLY** - if `.gitignore` hides something, say so out loud.
    - **DO NOT COMMIT AROUND YOUR OWN MESS** - ignored logs and caches are still files. See `cleanup.md`.
    - **DO NOT AMEND, FORCE-PUSH, SKIP HOOKS, OR COMMIT EMPTY** - fix it in a new commit.
    - **DO NOT COMMIT WITHOUT MY GO** - I am the only one who decides what lands.
