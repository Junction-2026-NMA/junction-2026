# Sponsor credits and accounts

Status as of Fri 13 Nov, 23:40 EET. No keys or codes are kept here. Ask Nicholas for access, and put keys only in `.env.local`.

| Service | Used for | Status | Account |
|---|---|---|---|
| Exa | Live offer search | Claimed: $120 balance | Nicholas |
| Context.dev | Offer pages turned into JSON | Claimed: 51,000 credits. **The team code is used; do not redeem it again.** | Nicholas |
| Verda (€200) | Nemotron GPU, EU hosting | **Claimed: €200.00** in the "Cloud Project" project. Each teammate can claim their own €200 through the hackerpack form; invite them to the project first and they redeem into it. Redeeming needs a payment method on the account. | Nicholas |
| NVIDIA Build | Hosted Nemotron fallback | **Key working (14 Nov 00:10).** One real tool call returned the right tool and arguments in 1.5 s. Function calling and structured output are supported, with a 262K context. | Nicholas |

## Keys (status only, never values)

Nicholas's `.env.local` holds working keys for Nemotron (NVIDIA Build), Exa, Context.dev and ElevenLabs. Each was tested on 14 Nov with one real call; all returned HTTP 200.
- The ElevenLabs key is restricted to text to speech, speech to text, reading voices, and models.
- Teammates: create your own free keys (Exa gives every participant $50, NVIDIA Build is free per account, ElevenLabs has a free tier), or get a key from Nicholas in person. Never share keys through git or chat.

## MCP servers the sponsors offer (for your coding agent, optional)

| Service | MCP | Notes |
|---|---|---|
| Context.dev | `https://mcp.context.dev/mcp` | Official, from the hackerpack. Lets your agent scrape or extract pages while you build. |
| Exa | Hosted MCP server (see Exa docs) | Mentioned in the hackerpack. Web search for your agent. |
| ElevenLabs | Official MCP server (see ElevenLabs docs) | Text to speech and voices from your agent. |

These are developer tools only. The Sisu app calls the REST APIs directly from its server routes.
| ElevenLabs | Voice in and out | Free plan active (10,000 credits a month, includes API). The MLH Creator code is saved but needs a card and renews at €26.05/month, so it is not applied. | Nicholas |
| Gemini | Speed fallback | Team form not sent. **One teammate aged 18 or over** fills it in (team name, name, email). A free Google AI Studio key works meanwhile. | — |
| OpenAI Codex | Coding help | Claimed: 2,500 credits (personal) | Nicholas |
| Anthropic, Modal, Featherless | Not used by Sisu | Claimed or pending earlier | Nicholas |

## Sponsor requirements to remember at submission

- **NVIDIA:** a short explanation of the exact model, its role, why it matters, and the quality it adds. Super VL must be used in the working app.
- **Context.dev:** the GitHub repo, the demo, and which endpoints we called and why. The call must sit in the core flow and visibly change a calculation.
- **Verda:** what the compute enabled that a laptop couldn't. Post the summary link in Verda's Discord.
- **Exa:** it must find current information the model could not know, with sources shown, and it must work on live judge queries.
- **ElevenLabs (MLH):** real two-way voice reaching our agent endpoint, not a canned clip.
