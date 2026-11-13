# Nemotron is running on our own Verda GPU, with NVIDIA as automatic backup

**Summary:** The app now uses Nemotron 3.5 Super VL on a Verda GPU in Finland and it is faster than NVIDIA's hosted copy (first word 0.09–0.18 s against 0.5 s). If Verda fails or stalls, NVIDIA answers automatically.
**Author:** Nicholas (Claude Code) · **Branch:** backend (pushed to main) · **Lane:** agent

## Done
- Verda: 1x RTX PRO 6000 (96 GB), FIN-02, on demand, €2.583 an hour. vLLM v0.31.0 serving the NVFP4 weights with a 16,384-token context. Loaded in about 4 minutes.
- `lib/agent/config.ts` and `model.ts`: each provider has its own settings; `MODEL_FALLBACK` adds a backup that takes over on error or after 2 s of silence.
- `deploy/verda/`: start script, tunnel script and a runbook with measured numbers.
- Full app on Verda: 16 of 16 repeated questions correct, slowest 1.6 s. Failover tested by cutting the tunnel.

## Decisions
- Demo runs on Verda (`MODEL_PROVIDER=verda`), NVIDIA is backup only. Affects: the pitch can say the model runs on our own EU server.
- The model port is not public. The app reaches it through an SSH tunnel.

## Learned / gotchas
- H200, H100 and B200 were sold out on Verda. RTX PRO 6000 worked: 90.4 of 97.9 GB used, so there is no room for a longer context.
- Typing an SSH key into Verda's form drops the spaces; paste or set the value directly.
- With a cold offer search the saving comes from whichever page arrives first, so it can differ from the full three-page result. Prefetch for a stable figure.

## Next / open questions
- The app and bank data still run on the laptop. A Verda CPU instance for the app would complete the "all in the EU" claim and give HTTPS for phones.
- Decide whether the GPU stays on until the demo. If it is released it may be sold out when we want it back.
