# Commands

## Server And Test Are Separate
- Never put a server start and a test in one command.
- Start the server detached, then check its port in a separate step.
- A server start is not a test.

## Detached Work
- Start servers, browser lanes, builds, and full test suites in the background
  with a log under the system temp folder, never inside the repo. Delete the log
  after the check.
- For a host-facing WSL server, use `serve.md`. Do not use `nohup`/`setsid` in a
  one-shot WSL call.
- Keep the host-side PID from `Start-Process wsl.exe ... -PassThru`.
- Poll logs with a bound. Do not read a silent command as progress.

## Bound Every Wait
- Give long commands an explicit timeout.
- A command that produces no new output is stuck. Stop it and inspect the
  process or port.
- Do not wait on the same stuck command again.

## Smallest Check First
- Run one targeted check first.
- Run the full suite once at the end.
- When a check passes, stop and report it. Repeating the same check is not
  verification.

## Clean Up
- Stop test servers, fake providers, and static servers when the check is done.
- Stop a WSL server through its Windows-side PID.
- Confirm the port is closed. A process that survived the terminal is not proof
  that it is reachable.
- Delete the logs, coverage and generated output you created. See `../cleanup.md`.
