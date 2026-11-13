# Hosting Sisu on Verda

Why: the pitch is that a bank can run Sisu on its own European servers with an open model, so customer data never goes to a model provider. This folder is how we make that true for the demo.

**Status: prepared, not yet run.** Starting a GPU spends Verda credits, so Nicholas starts it.

## What runs where

| Piece | Today | On Verda |
|---|---|---|
| Reasoning model (Nemotron 3.5 Super VL) | NVIDIA's hosted trial (logs inputs) | **Our own GPU instance**, served by vLLM |
| App and finance engine (holds the bank data) | Laptop | **A small CPU instance** next to the GPU |
| Exa, Context.dev | Their clouds | Unchanged. They only ever get the bill type and city. |
| ElevenLabs voice | Its cloud | Unchanged. Be honest in the pitch: speech still leaves the EU box. A bank would swap in a self-hosted speech model. |

## Cost (Verda public prices, 14 Nov)

| Instance | Use | Price |
|---|---|---|
| 1x H200, 141 GB | Nemotron, NVFP4 weights (75 GB, 91 GB minimum) | about $6.64 an hour on demand |
| CPU.4V.16G | The Next.js app | about $0.05 an hour |

€200 of credit is about 30 hours of H200. **Use on-demand, not spot**: a spot instance can be taken away mid-demo. Stop the GPU when nobody is testing.
The vLLM recipe also lists a 96 GB RTX PRO 6000 profile (about $2.81 an hour). It is cheaper but leaves almost no memory headroom; ask Verda's booth before choosing it.

## Steps

1. **GPU instance.** In the Verda console: Instances → deploy → 1x H200, an Ubuntu image with Docker and NVIDIA drivers, plus a 150 GB volume mounted at `/mnt/models`. Add your SSH key.
2. **Start the model.** Copy `serve-nemotron.sh` to the instance and run it with a key you invent:
   ```bash
   VLLM_API_KEY=<long random string> sh serve-nemotron.sh
   ```
   The first start downloads 75 GB and can take 15 minutes or more. It is ready when the log says the server is listening on port 8000.
3. **Lock it down.** Allow port 8000 only from the app's IP address (Verda firewall), not from the whole internet.
4. **Point the app at it.** In the app's `.env.local`:
   ```
   MODEL_PROVIDER=verda
   NEMOTRON_BASE_URL=http://<gpu-instance-ip>:8000/v1
   NEMOTRON_API_KEY=<the same long random string>
   NEMOTRON_MODEL=nvidia/nemotron-3.5-super-vl-120b-a12b
   ```
5. **Measure.** Run `node tests/agent-latency.mjs http://localhost:3000`. Keep Verda for the demo only if the first word arrives about as fast as NVIDIA's endpoint (0.5 s). Otherwise demo on NVIDIA and show Verda as the working sovereign option.
6. **App instance (for the full "data stays in the EU" claim and for phone testing).** On a CPU instance: install Node 22, clone the repo, add `.env.local`, then `npm ci && npm run build && npm run start`. Put Caddy in front for HTTPS, because phone browsers only allow the microphone over HTTPS.

## What to check on the first run

- Thinking off: the app sends `chat_template_kwargs: {"enable_thinking": false}`. Confirm the first word is fast; if answers start with hidden reasoning, the flag is not being honoured.
- Tool calls: test 2 and 3 in the latency script must show `get_spending` and `search_offers`.
- The recipe's full command has extra speed flags (speculative decoding, cache settings). They are left out here to keep the first start simple; add them from the recipe page once it runs.

For Verda's prize, write down what the GPU made possible that a laptop could not, and post the summary in their Discord.
