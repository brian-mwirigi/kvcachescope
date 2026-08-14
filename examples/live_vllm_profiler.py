"""
Live vLLM KVCacheScope Profiler Demo
====================================
Runs an actual vLLM engine with real continuous batching and streams live
physical GPU block allocations, refcounts, and logical block tables to KVCacheScope.

Requirements:
    pip install vllm torch fastapi uvicorn websockets

Run:
    python examples/live_vllm_profiler.py --model facebook/opt-125m --port 8000
"""

import sys
import time
import asyncio
import threading
import argparse
import random

# Try importing vLLM
try:
    from vllm import LLMEngine, EngineArgs, SamplingParams
    HAS_VLLM = True
except ImportError:
    HAS_VLLM = False

from backend.vllm_hook import attach_vllm_hook
from backend.server import app, ws_manager, analyzer, engine as sim_engine
import uvicorn

PROMPTS = [
    "Explain the core mechanism of PagedAttention virtual memory block allocation.",
    "Draft an RFC for disaggregated prefill and decode KV cache transfer over RDMA.",
    "Analyze the memory consumption profile of our vLLM worker nodes under 8k context length.",
    "Write a high-performance C++ CUDA kernel for block-sparse attention gathering.",
    "Compare prefix caching radix trees with hash-based exact block match lookup tables."
]

def run_server(port=8000):
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")

def main():
    parser = argparse.ArgumentParser(description="Live vLLM KVCacheScope Profiler")
    parser.add_argument("--model", type=str, default="facebook/opt-125m", help="HuggingFace model to load")
    parser.add_argument("--port", type=int, default=8000, help="Web dashboard port")
    parser.add_argument("--concurrency", type=int, default=4, help="Concurrent request streams")
    args = parser.parse_args()

    # Start KVCacheScope web server in background
    srv_thread = threading.Thread(target=run_server, args=(args.port,), daemon=True)
    srv_thread.start()
    print(f"\n[KVCacheScope] Live Dashboard started on http://localhost:{args.port}")

    if not HAS_VLLM:
        print("[!] vLLM not detected in local environment. Running with live vLLM mock adapter harness.")
        print("[!] In a GPU environment with vLLM installed, this will profile real CUDA VRAM block tables.")
        while True:
            time.sleep(1.0)
        return

    print(f"[*] Initializing real vLLM engine with model: {args.model}...")
    engine_args = EngineArgs(
        model=args.model,
        enable_prefix_caching=True,
        max_num_seqs=16,
        gpu_memory_utilization=0.6
    )
    llm_engine = LLMEngine.from_engine_args(engine_args)

    # Attach KVCacheScope live hook
    hook = attach_vllm_hook(llm_engine, port=args.port)
    print(f"[+] KVCacheScope telemetry hook attached to vLLM engine!")

    sampling_params = SamplingParams(temperature=0.7, top_p=0.9, max_tokens=64)

    req_id = 0
    print("[*] Generating live batch traffic to vLLM...")
    try:
        while True:
            # Inject new request if engine has capacity
            if llm_engine.has_unfinished_requests():
                step_outputs = llm_engine.step()
                for output in step_outputs:
                    if output.finished:
                        print(f"[vLLM] Finished Request {output.request_id} ({len(output.outputs[0].token_ids)} tokens)")
            
            # Submit new requests
            if random.random() < 0.3:
                req_id += 1
                prompt = random.choice(PROMPTS)
                llm_engine.add_request(f"live_req_{req_id}", prompt, sampling_params)
                print(f"[vLLM] Added Request live_req_{req_id}: '{prompt[:32]}...'")

            time.sleep(0.08)
    except KeyboardInterrupt:
        print("\n[!] Profiler stopped.")

if __name__ == "__main__":
    main()
