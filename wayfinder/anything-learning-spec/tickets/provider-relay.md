**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# A relay for the learner's own provider

## Question

The hosted app calls the learner's own provider from the browser. Some providers
refuse that: they send no CORS headers, or their preflight never succeeds, so the
browser never delivers the call — the learner sees a failure even though the
address, the model and the key are correct. Mercury works from the browser; at
least one other provider does not. The app already runs a small server for the
paid provider. Can that server also carry the learner's own calls, without
turning the learner's key into something the server stores, and without forcing
everyone through it?

## Resolution

- **Direct stays first.** Every call to the learner's own provider is attempted
  from the browser first. A provider that answers the browser — Mercury is the
  standing example — is unchanged.
- **The relay is a fallback, not a road.** Only a browser-level "could not reach
  it" failure (the CORS class) is retried through the operator's server. An HTTP
  answer, including 401, 404, 429 or 5xx, means the provider was reached, so the
  key is not sent anywhere. A timeout is not a trigger either.
- **Per call, nothing kept.** The browser sends the provider address, model,
  messages, temperature and the learner's key for one call. The server forwards
  them and stores neither the key nor the prompt nor the answer. It never falls
  back to the operator's key.
- **Open to anyone with a key.** The relay is not behind the subscription; the
  learner's own key pays the model, so a relayed call costs the operator no model
  money. A per-address hourly cap protects the service.
- **Narrow target, hard guards.** HTTPS on port 443, no credentials in the
  address, the path must end in `/chat/completions`, private/loopback/link-local
  addresses are refused after DNS resolution and the connection is pinned to the
  checked address, redirects are not followed, and the existing body, reply and
  timeout ceilings apply.
- **Remembered and visible.** The app remembers which host needed the relay (in
  settings, capped at ten). The provider card names the road, and Test connection
  always tries direct first and reports which road answered. Saving a profile
  clears the memory.
- **Honest privacy line.** The settings card says the key is sent to the relay
  for each call, and is not stored there. The old promise that the key never
  leaves the browser becomes "stays in this browser unless your provider refuses
  browser calls".

## Why

A browser cannot make a provider accept its origin. The only honest fix that
keeps the key out of the public bundle and out of a server store is a stateless
forwarder the operator runs. Making it a fallback protects the privacy promise
for every provider that already works and keeps the relay from becoming the
default path for everyone.

An unrestricted forwarder would be an SSRF and open-proxy risk, so the target is
narrowed to secure chat-completion endpoints and checked at the address actually
connected to. That is the trade the learner accepted ("use it to guard").

## Source

Learner messages, 2026-10-28, verbatim (voice dictation; homophones left as
spoken):

> "Ok, I think I get what you're saying. It's a sort of relay, right? ... Some
> LLM. Might not work. I tried it with one LLM and it's. It's giving CORS error
> because. It's not allowing the browser to knock on the door. ... If we use this
> relay, it might be better because it's not. It's not coming from the browser,
> it's coming from the relay, right?"

> "Some providers. Whoa. On the browser. I was using Mercury. Mercury was working
> perfectly in the browser, but another provider was not working. So, is there a
> way we can just test? We can only go through the server if. Their own provider
> is not working."

> "Yes, you can go."

Answer to "Who may use the relay with their own provider and key?":
> "Anyone with their own key (Recommended)."

The full question-and-answer record is
`docs/features/provider-relay/GRILL-provider-relay.txt`.
