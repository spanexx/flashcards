# Environment

## Paths
- Git runs in WSL Debian.
- WSL files are reached at `\\wsl.localhost\Debian\...`; use that directly.
- Do not hardcode a Windows path, drive letter, or user directory.
- Keep build output on WSL's disk. Installing into `/mnt/c` has timed out before.

## Two Localhosts
- WSL's `localhost` is not the Windows host's `localhost`.
- A Windows provider at `localhost:<port>` is unreachable from WSL. The old v1
  server swapped a loopback provider host for the Windows host address.
- The reverse also breaks: Windows `localhost` does not always reach a WSL
  server, and a WSL-internal `200` looks healthy while the browser cannot open
  the page. Use `serve.md` before reporting a server as running.
- The WSL guest IP changes between boots. Look it up with
  `wsl -d Debian -- hostname -I`; never hardcode it.
- The guest IP is still machine-local. Do not expose the server off the machine.

## When WSL Renumbers
- Localhost forwarding can stop after WSL restarts or renumbers.
- Starting a host-facing WSL server from Windows through `wsl.exe` keeps a
  Windows-side process attached and was the difference between a dead page and a
  working one on 2026-10-24.
- If localhost still fails but the guest IP works, hand over the guest IP and
  record that localhost forwarding is broken.
