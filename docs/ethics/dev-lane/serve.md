# Serve

## The App Is A Page
- The browser rebuild has no runtime API. Serve `v1/out/` as plain files.
- A static file server is enough. It does not need the provider or a key.

## Windows Reachability Gate
- A server started in WSL is **not up** until the Windows host can open it.
- A `200` from `curl` inside WSL is not evidence.
- Observed on 2026-10-24: a server launched with `setsid -f` answered `200`
  inside WSL, but Windows reset both `localhost` and the guest-IP request. The
  same WSL server launched through a Windows-side `Start-Process wsl.exe`
  answered `200` on both addresses.

## Start
Start the WSL command from Windows. Replace the placeholder with the absolute
path to `v1` inside WSL:

```powershell
$v1 = '<absolute path to v1>'
$p = Start-Process wsl.exe -ArgumentList @(
  '-d','Debian','--cd',$v1,'--',
  'python3','-m','http.server','4173','--bind','0.0.0.0','--directory','out'
) -WindowStyle Hidden -PassThru
$p.Id
```

- Keep the host-side PID.
- Do not use `nohup`/`setsid` in a one-shot WSL call for this server.
- Bind `0.0.0.0`. A WSL-only `127.0.0.1` bind is not a Windows-facing server.
- Open the page only after the reachability check passes.

## Verify From Windows
Run this in a separate step:

```powershell
$ip = (wsl -d Debian -- hostname -I).Trim().Split(' ')[0]
curl.exe -sS -o NUL -w "localhost=%{http_code}`n" --max-time 5 "http://127.0.0.1:4173/"
curl.exe -sS -o NUL -w "guest=%{http_code}`n" --max-time 5 "http://$ip`:4173/"
```

- `localhost` is what the learner usually opens.
- The guest IP proves the WSL bind independently of localhost forwarding.
- If only the guest IP answers, hand over that address and record that localhost
  forwarding is broken. If neither answers, the server is not up.
- Do not report success based on a WSL-internal check.
- After a rebuild, hard refresh; an old service worker can still show the old
  bundle.

## Stop
- Stop through the Windows-side PID.
- Confirm the port is closed.
- Delete the server log after the stop; it belongs under system temp, not the repo.
- A process that survived the terminal is not evidence that it is reachable.
