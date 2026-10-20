**Type:** grilling
**Status:** resolved
**Delivery:** feature-pipeline
**Blocks:** -

# How the learner opens the app

## Question

The map carried this as fog: desktop application, or a browser tab on the learner's own machine. It could not stay fog any longer, because the first build decides it whether or not the decision was made on purpose. Locked as part of taking on version one, and it carries a consequence for a decision that was already made elsewhere - see below.

Decide: how the app is opened and closed; where it runs; what the learner sees when the machine is offline; and what the build is required to do before it counts as working.

## Resolution

**A browser tab on the learner's own machine.** The learner starts a local Express process and opens a URL served from loopback. Angular is the interface, served by Express, on the learner's machine, and nowhere else. Accepted costs: a visible process the learner must start, and a browser tab rather than an application icon. Reason the stack is well matched: the app is served locally anyway, and it means the app is fully usable with no provider and no network, which the privacy ticket locked as a hard requirement.

**What this does to the key store: nothing. An earlier reading of this ticket said the browser made T2 unbuildable, and that reading was wrong.** Only the *page* cannot reach the OS key store - Windows Credential Manager, the macOS Keychain, the Linux secret service are all out of reach of page JavaScript, and that is a boundary browsers maintain on purpose. But the page never needs to reach it. The local Express process is Node running natively on the learner's machine, and it can.

**So the key store decision survives intact, and in practice gets stronger.** The key lives in the OS key store exactly as T2 locked. The local process holds it. The page asks the local process to make the provider call, and the key never crosses into the page - not even transiently. Under the original reading the app held the key and a front-end mistake could reach it; under this one the front end provably cannot reach it at all.

**This is now a build requirement, and it is a strict one:** every provider call is made by the local process. The browser sends the prompt to loopback and nothing else. No key, no provider call, and no prompt construction happens in the front end. A build in which Angular holds the key is a build that has drifted from this decision.

**Accepted costs of the browser:** a visible process the learner must start, and a browser tab rather than an application icon.