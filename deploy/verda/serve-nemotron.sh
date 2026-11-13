#!/bin/sh
# Serves NVIDIA Nemotron 3.5 Super VL on a Verda GPU instance with vLLM's OpenAI-compatible server.
# Run this ON the Verda instance. Defaults suit 1x RTX PRO 6000 (96 GB): the recipe's context there is 16,384.
# On a 1x H200 (141 GB) use MAX_MODEL_LEN=114688.
#
#   VLLM_API_KEY=<a long random string you choose>  sh serve-nemotron.sh
#
# The server listens only on the instance itself (127.0.0.1). Reach it through an SSH tunnel or a
# private network, never a public port.
#
# Flags come from the vLLM recipe for this model (single H200, NVFP4 weights):
# https://recipes.vllm.ai/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-NVFP4
set -eu

: "${VLLM_API_KEY:?Set VLLM_API_KEY to a long random string. The app sends it as NEMOTRON_API_KEY.}"
MODEL="nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-NVFP4"
# Keep the 75 GB of weights on a persistent volume so a restart does not download them again.
HF_CACHE="${HF_CACHE:-/root/models/huggingface}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-16384}"
mkdir -p "$HF_CACHE"

docker run -d --name nemotron --restart unless-stopped --gpus all --ipc=host -p 127.0.0.1:8000:8000 \
  -v "$HF_CACHE:/root/.cache/huggingface" \
  ${HF_TOKEN:+-e HF_TOKEN="$HF_TOKEN"} \
  vllm/vllm-openai:v0.31.0 \
  "$MODEL" \
  --served-model-name nvidia/nemotron-3.5-super-vl-120b-a12b \
  --api-key "$VLLM_API_KEY" \
  --trust-remote-code \
  --tensor-parallel-size 1 \
  --max-model-len "$MAX_MODEL_LEN" \
  --max-num-seqs 8 \
  --mamba-backend flashinfer \
  --mamba-ssm-cache-dtype float16 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --reasoning-parser nemotron_v3

echo "Started. Follow the load with: docker logs -f nemotron"
