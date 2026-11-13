# Hosting Sisu on Verda

Why: the pitch is that a bank can run Sisu on its own European servers with an open model, so customer data never goes to a model provider. This folder is how we make that true for the demo.

**Status: running and verified (14 Nov, 03:50).** Nemotron 3.5 Super VL is serving from one RTX PRO 6000 in Verda's FIN-02 data centre in Finland.

| Measured | Verda (our GPU) | NVIDIA Build (hosted) |
|---|---|---|
| First word | 0.09–0.18 s | 0.49–0.58 s |
| Tool choice, complete | 0.37 s | 0.60 s |
| Full app, 16 repeated questions | 16 of 16 correct, slowest 1.6 s | 16 of 16 correct, one 7 s stall |
| Load time from a cold start | about 4 minutes including the 70 GB download | n/a |

GPU memory in use: 90.4 of 97.9 GB. The app runs with `MODEL_PROVIDER=verda` and `MODEL_FALLBACK=nvidia`: if Verda errors or is silent for 2 s, NVIDIA's hosted copy answers and the trace says "backup".

## Turning it on (once the instance exists)

```bash
# 1. On the instance, if the container is not already running (it restarts by itself after a reboot):
VLLM_API_KEY=<the key in .env.local as VERDA_API_KEY> sh /root/serve-nemotron.sh
# 2. On the laptop that runs the app:
sh deploy/verda/tunnel.sh <instance-ip>
# 3. Check:
node tests/agent-latency.mjs http://localhost:3000
```

## What runs where

| Piece | Today | On Verda |
|---|---|---|
| Reasoning model (Nemotron 3.5 Super VL) | **Our own Verda GPU**, served by vLLM, reached through an SSH tunnel. NVIDIA's hosted trial is the automatic backup. | The same |
| App and finance engine (holds the bank data) | Laptop | **A small CPU instance** next to the GPU (not done yet) |
| Exa, Context.dev | Their clouds | Unchanged. They only ever get the bill type and city. |
| ElevenLabs voice | Its cloud | Unchanged. Be honest in the pitch: speech still leaves the EU box. A bank would swap in a self-hosted speech model. |

## Cost (Verda public prices, 14 Nov)

| Instance | Use | Price |
|---|---|---|
| 1x H200, 141 GB | Nemotron, NVFP4 weights (75 GB, 91 GB minimum) | about $6.64 an hour on demand |
| CPU.4V.16G | The Next.js app | about $0.05 an hour |

**Availability check, 14 Nov 03:15 (console, logged in):** H200, H100, B200 and B300 all show "Notify me" (sold out). Available now: **1x RTX PRO 6000, 96 GB, €2.546 an hour in FIN-03** (2x is unavailable), plus A100 80 GB in 1x to 8x. Verda's ready-made inference offers only Kimi and DeepSeek. So the realistic first try is 1x RTX PRO 6000, which the vLLM recipe lists for this model but with almost no memory headroom (91 GB needed of 96 GB): lower `--max-model-len` if it fails to load. €200 is about 78 hours of it.

If an H200 becomes available: €200 of credit is about 30 hours of H200. **Use on-demand, not spot**: a spot instance can be taken away mid-demo. Stop the GPU when nobody is testing.
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
