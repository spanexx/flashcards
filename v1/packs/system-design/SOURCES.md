# System Design — sources and media credits

This pack is a study course, not a copy of any one book. Each deck below names
the documents that shaped it. The card wording is ours; the facts follow the
sources listed. Links were checked on 2026-10-29.

## Deck references

### foundations
- Richards & Ford, *Fundamentals of Software Architecture* — architecture as the decisions that are hard to change, and trade-offs as the architect's main work. https://www.oreilly.com/library/view/fundamentals-of-software/9781492043447/
- Parnas, *On the Criteria To Be Used in Decomposing Systems into Modules* (1972) — information hiding and boundaries. https://dl.acm.org/doi/10.1145/361598.361623
- Fowler, *MonolithFirst* — starting simple and earning a split. https://martinfowler.com/bliki/MonolithFirst.html

### requirements
- Bass, Clements & Kazman, *Software Architecture in Practice* — quality attributes and architecture drivers. https://www.oreilly.com/library/view/software-architecture-in/9780136885726/
- Google SRE Workbook, *Implementing SLOs* — targets and error budgets. https://sre.google/workbook/implementing-slos/
- Nygard, *Documenting Architecture Decisions* (2011) — the ADR shape. https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- SEI, *Architecture Tradeoff Analysis Method* — comparing options against qualities. https://www.sei.cmu.edu/library/architecture-tradeoff-analysis-method-collection/

### styles
- Fowler, *MonolithFirst* and *MicroservicePremium* — when a monolith is the cheaper choice. https://martinfowler.com/bliki/MicroservicePremium.html
- microservices.io pattern catalogue — database per service, CQRS, event sourcing, saga. https://microservices.io/patterns/
- AWS, *Serverless* overview — event-driven functions and managed capacity. https://aws.amazon.com/serverless/

### data
- Kleppmann, *Designing Data-Intensive Applications* — replication, partitioning, consistency. https://dataintensive.net/
- AWS, *Caching best practices* — cache-aside and invalidation. https://aws.amazon.com/caching/best-practices/
- IETF, *The Idempotency-Key HTTP Header Field* (draft) — repeat-safe writes. https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/
- Brewer, *CAP Twelve Years Later* — the partition choice. https://www.infoq.com/articles/cap-twelve-years-later-how-the-rules-have-changed/

### reliability
- Google SRE Book, *Service Level Objectives*. https://sre.google/sre-book/service-level-objectives/
- AWS Builders' Library, *Timeouts, retries, and backoff with jitter*. https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- OpenTelemetry, *What is OpenTelemetry?* — logs, metrics and traces as signals. https://opentelemetry.io/docs/what-is-opentelemetry/
- *Principles of Chaos Engineering*. https://principlesofchaos.org/
- Netflix, *The evolution of chaos engineering at Netflix* (NFX303, re:Invent 2022). https://www.youtube.com/watch?v=Xbn65E-BQhA

### security
- OWASP, *Top 10:2021* — broken access control at A01. https://owasp.org/Top10/
- Microsoft, *STRIDE threat model*. https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats
- OpenSSF, *SLSA specification — levels*. https://slsa.dev/spec/v1.1/levels
- NIST, *Secure Software Development Framework (SP 800-218)*. https://csrc.nist.gov/pubs/sp/800/218/final
- CISA, *Software Bill of Materials*. https://www.cisa.gov/sbom

### ai-architecture
- Lewis et al., *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks* (2020). https://arxiv.org/abs/2005.11401
- NIST, *AI Risk Management Framework* — Govern, Map, Measure, Manage. https://www.nist.gov/itl/ai-risk-management-framework
- OWASP, *Top 10 for LLM Applications* — prompt injection as LLM01. https://genai.owasp.org/llm-top-10/
- Anthropic, *Create strong empirical evaluations*. https://docs.anthropic.com/en/docs/build-with-claude/develop-tests

### ai-engineering
- GitHub Docs, *Using Copilot code review* — comments, not an approval. https://docs.github.com/en/copilot/using-github-copilot/code-review/using-copilot-code-review
- NIST, *Secure Software Development Framework (SP 800-218)* — review and provenance for all code. https://csrc.nist.gov/pubs/sp/800/218/final
- GitHub, *How to automate code reviews and testing with GitHub Copilot* (video). https://www.youtube.com/watch?v=HDEGFNAUkX8

### delivery
- DORA, *Accelerate State of DevOps Report 2024* — AI raises throughput while stability can fall. https://dora.dev/research/2024/dora-report/
- DORA, *DORA's software delivery metrics: the four keys* — the current five measures are listed in the 2024 report. https://dora.dev/guides/dora-metrics-four-keys/
- Fowler, *Trunk-Based Development*. https://martinfowler.com/bliki/TrunkBasedDevelopment.html
- Hodgson, *Feature Toggles (aka Feature Flags)*. https://martinfowler.com/articles/feature-toggles.html
- HashiCorp, *What is Infrastructure as Code?* https://developer.hashicorp.com/terraform/intro
- Humble & Farley, *Continuous Delivery*. https://continuousdelivery.com/

### ci-cd
- GitHub Docs, *GitHub Actions*. https://docs.github.com/en/actions
- GitHub Docs, *Security hardening for GitHub Actions*. https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
- Google SRE Workbook, *Canarying Releases*. https://sre.google/workbook/canarying-releases/
- Humble & Farley, *Continuous Delivery* — the deployment pipeline and build-once rule. https://continuousdelivery.com/

## Video clips

All videos are embedded from YouTube by id. If a video is removed, the app shows
its search phrase and an "Open on YouTube" link, the teaching-layers fallback.
Every id below was checked through YouTube oEmbed on 2026-10-29; a fresh-eyes
review re-ran the check the same day and all 24 answered HTTP 200 with matching
channels.

| Deck | Id | Title | Channel |
| --- | --- | --- | --- |
| foundations | `K7RkjKTIQbo` | Mark Richards and Neal Ford: Software Architecture Fundamentals | Archil Sharashenidze |
| foundations | `vGlxwcyrVd8` | Mark Richards and Neal Ford Reflect on Software Architecture: The Hard Parts | Book Overflow |
| requirements | `GhB7vz3sg-0` | Architectural Decision Records (ADR): What They Are and How Architects Should Use Them | Go Cloud Architects |
| requirements | `s4LI1jDn6IY` | Understanding Modern Trade-off Analysis in Software Architecture | iSAQB |
| styles | `Xo3rsiZYsJQ` | Modular Monoliths: How To Build One & Lessons Learned | Milan Jovanović |
| styles | `6giotJL8bzc` | Monolithic vs. Microservices Architecture | Java Guides |
| data | `5qk4p1jnSgg` | Cache Invalidation Explained: Strategies & Consistency Challenges | CodeLucky |
| data | `I08syTslan8` | What is API Idempotency and Why Is It Important? | Be A Better Dev |
| reliability | `Akri1BlGp10` | SLO vs SLI vs SLA vs Error Budget | Tech Tutorials with Piyush |
| reliability | `35N2buePMsg` | Monitoring vs Observability: Logs, Metrics, Traces, APM, RUM & Costs | Merge Ready |
| reliability | `Xbn65E-BQhA` | AWS re:Invent 2022 — The evolution of chaos engineering at Netflix | AWS Events |
| security | `rEnJYNkUde0` | STRIDE Threat Modeling for Beginners | Netsec Explained |
| security | `K_G10zywoTs` | What Is SLSA? Supply Chain Levels for Software Artifacts Explained | Harness |
| ai-architecture | `T-D1OfcDW1M` | What is Retrieval-Augmented Generation (RAG)? | IBM Technology |
| ai-architecture | `a3SMraZWNNs` | How to Systematically Setup LLM Evals | Dave Ebbelaar |
| ai-engineering | `HDEGFNAUkX8` | How to automate code reviews and testing with GitHub Copilot | GitHub |
| ai-engineering | `X0UI0O8YzJM` | How Developers Secure AI-Generated Code: 5 Security Best Practices | IBM Technology |
| delivery | `a_iq0ZMU9Co` | Trunk-Based Development Explained | CodeLucky |
| delivery | `lqsENcje41w` | DORA Metrics Explained: The Four Key Measures of DevOps Performance | Harness |
| delivery | `zWw2wuiKd5o` | What is Infrastructure as Code? | IBM Technology |
| ci-cd | `Lj9SennFygM` | How to build a complete CI pipeline with GitHub actions | 3CodeCamp |
| ci-cd | `qoalS5ae7fk` | CI/CD Made Easy with GitHub Actions | DevOps Vijay |
| ci-cd | `HKkhD6nokC8` | Progressive Delivery Explained | DevOps & AI Toolkit |
| ci-cd | `sFzKrGSaIr8` | Testing in Production! Progressive Delivery with Canary Deployments | DevOps & AI Toolkit |

## Photographs

Downloaded from Wikimedia Commons at 1600 px wide and converted to WebP
(quality 82). `server-rack.webp` is cropped above a creator watermark; the
original is linked below.

| File | Original | Creator | Licence |
| --- | --- | --- | --- |
| `telephone-exchange-1918.webp` | [Chinese Telephone Exchange, San Francisco, 1918](https://commons.wikimedia.org/wiki/File:Chinese_Telephone_Exchange,_San_Francisco,_California,_1918.jpg) | Anonymous | Public domain |
| `golden-gate-bridge.webp` | [Golden Gate Bridge by night](https://commons.wikimedia.org/wiki/File:Golden_Gate_Bridge_by_night.jpg) | Daniel Schwen | CC BY-SA 3.0 |
| `circuit-board.webp` | [Printed Circuit Board 9990](https://commons.wikimedia.org/wiki/File:Printed_Circuit_Board_9990.jpg) | Ashley Pomeroy | CC BY 4.0 |
| `card-catalog.webp` | [Schlagwortkatalog](https://commons.wikimedia.org/wiki/File:Schlagwortkatalog.jpg) | Dr. Marcus Gossler | CC BY-SA 3.0 |
| `power-grid.webp` | [High voltage power grid of the United States](https://commons.wikimedia.org/wiki/File:High_voltage_power_grid_of_the_United_States.webp) | Wikideas1 | CC0 |
| `padlock.webp` | [Abloy padlock in Oulu](https://commons.wikimedia.org/wiki/File:Abloy_padlock_in_Oulu.jpg) | Quim Gil | CC0 |
| `server-rack.webp` | [Hashcat testing with an AMD Epyc Supermicro Nvidia GPU server](https://commons.wikimedia.org/wiki/File:Client_Project_Hashcat_Testing_With_an_AMD_Epyc_Supermicro_Nvidia_GPU_Server_Using_Proxmox_(Lawrence_Systems)_03.png) | Lawrence Systems | CC BY 3.0 |
| `code-on-screen.webp` | [Code on computer monitor](https://commons.wikimedia.org/wiki/File:Code_on_computer_monitor_(Unsplash).jpg) | Markus Spiske | CC0 |
| `container-ship.webp` | [Container ship Sirrah at the port of Hamburg](https://commons.wikimedia.org/wiki/File:Container_ship_Sirrah,_IMO_9255402,_Unifeeder_at_container_terminal_Tollerot,_port_of_Hamburg-1029240.jpg) | Raimond Spekking | CC BY-SA 4.0 |
| `data-center.webp` | [BalticServers data center](https://commons.wikimedia.org/wiki/File:BalticServers_data_center.jpg) | BalticServers.com | CC BY-SA 3.0 |

## Diagrams and animations

The 18 SVGs in `images/` are original work for this pack, drawn in the app's
palette. Ten carry a small CSS/SMIL animation and honour
`prefers-reduced-motion`:

`boundaries-anim`, `tradeoffs-anim`, `services-anim`, `cache-path-anim`,
`retry-backoff-anim`, `supply-chain-anim`, `rag-loop-anim`, `review-gate-anim`,
`feature-flag-anim`, `canary-anim`.

Static diagrams:

`latency-budget`, `styles-compare`, `data-ownership`, `slo-budget`,
`trust-boundaries`, `eval-loop`, `dora-metrics`, `pipeline-stages`.
