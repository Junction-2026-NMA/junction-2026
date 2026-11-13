#!/bin/sh
# Serves NVIDIA Nemotron 3.5 Super VL on a Verda GPU instance with vLLM's OpenAI-compatible server.
# Run this ON the Verda instance (1x H200, 141 GB). Not yet run by us: treat the first run as a test.
#
#   VLLM_API_KEY=<a long random string you choose>  sh serve-nemotron.sh
#
# Flags come from the vLLM recipe for this model (single H200, NVFP4 weights):
# https://recipes.vllm.ai/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-NVFP4
set -eu

: "${VLLM_API_KEY:?Set VLLM_API_KEY to a long random string. The app sends it as NEMOTRON_API_KEY.}"
MODEL="nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-NVFP4"
# Keep the 75 GB of weights on a persistent volume so a restart does not download them again.
HF_CACHE="${HF_CACHE:-/mnt/models/huggingface}"
mkdir -p "$HF_CACHE"

docker run --rm --gpus all --ipc=host -p 8000:8000 \
  -v "$HF_CACHE:/root/.cache/huggingface" \
  ${HF_TOKEN:+-e HF_TOKEN="$HF_TOKEN"} \
  vllm/vllm-openai:v0.31.0 \
  "$MODEL" \
  --served-model-name nvidia/nemotron-3.5-super-vl-120b-a12b \
  --api-key "$VLLM_API_KEY" \
  --trust-remote-code \
  --tensor-parallel-size 1 \
  --max-model-len 32768 \
  --max-num-seqs 16 \
  --mamba-backend flashinfer \
  --mamba-ssm-cache-dtype float16 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --reasoning-parser nemotron_v3
