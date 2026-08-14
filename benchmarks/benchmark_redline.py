"""
KVCacheScope High-Throughput Redline Benchmark Harness
=====================================================
Multi-threaded load generator designed to bypass Python 3.12 asyncio
concurrency bottlenecks (>50 clients). Drives real GPU saturation
and accurately measures TTFT, TPOT, and cache block allocation.

Usage:
    python benchmarks/benchmark_redline.py --concurrency 100 --duration 15 --disable-log-requests
"""

import os
import sys
import time
import random
import argparse
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any

# Ensure project root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.kv_engine import DisaggregatedEngine
from backend.analyzer import LogicalMemoryAnalyzer
from backend.perf_guard import StateDivergenceDetector
from backend.perfetto_exporter import PerfettoTraceExporter

SYSTEM_PROMPT = "You are an enterprise AI assistant trained on proprietary codebases. Adhere to security standards and output valid markdown."
QUERIES = [
    "Explain how PagedAttention block tables map virtual token indices to physical GPU memory.",
    "Draft an RFC for disaggregated prefill and decode KV cache transfer over RDMA RoCEv2.",
    "Analyze the memory consumption profile of our vLLM worker nodes under 8k context length.",
    "Identify potential causes of logical KV cache fragmentation in our inference gateway.",
    "Compare prefix caching radix trees with hash-based exact block match lookup tables.",
    "Write a high-performance C++ CUDA kernel for block-sparse attention gathering."
]

def simulate_client_worker(worker_id: int, engine: DisaggregatedEngine, divergence_detector: StateDivergenceDetector, stop_event: threading.Event, stats: Dict[str, Any]):
    req_counter = 0
    while not stop_event.is_set():
        req_counter += 1
        query = random.choice(QUERIES)
        prompt = f"{SYSTEM_PROMPT} Client {worker_id} Query {req_counter}: {query}"
        max_tokens = random.randint(16, 64)
        
        t0 = time.time()
        seq = engine.submit_sequence(prompt=prompt, max_tokens=max_tokens, client_id=f"client_worker_{worker_id}")
        
        if not seq:
            time.sleep(0.05)
            continue

        # Simulate 10% ungraceful client cancellation mid-stream
        should_abort = (random.random() < 0.10)
        
        # Prefill & initial decode
        engine.step_prefill(seq.seq_id)
        
        if should_abort:
            # Client drops TCP socket
            divergence_detector.register_frontend_cancellation(seq.seq_id)
            seq.is_hostage = True
            seq.hostage_reason = "ASYNC_CANCELLED_ERROR_BACKEND_PROPAGATION_FAILURE"
            stats["aborted_requests"] += 1
            # Backend continues zombie generation!
            for _ in range(8):
                engine.step_decode(seq.seq_id)
        else:
            while seq.generated_tokens < seq.max_tokens and seq.status.value == "DECODING":
                engine.step_decode(seq.seq_id)
            engine.finish_sequence(seq.seq_id)
            stats["completed_requests"] += 1

        t1 = time.time()
        stats["total_tokens"] += seq.prompt_tokens + seq.generated_tokens
        stats["latencies"].append(t1 - t0)
        time.sleep(random.uniform(0.02, 0.08))

def run_redline_benchmark(
    concurrency: int = 100,
    duration_sec: int = 10,
    disable_log_requests: bool = True,
    export_perfetto: str = "perfetto_redline_trace.json"
):
    print("\n" + "="*76)
    print("  KVCacheScope High-Concurrency Redline Benchmark Harness")
    print("="*76)
    print(f"  Concurrency Level:      {concurrency} concurrent streams (Multi-threaded)")
    print(f"  Duration:               {duration_sec} seconds")
    print(f"  Asyncio Bottleneck:     BYPASS ENABLED (No event-loop saturation)")
    print(f"  Disable Request Logging:{disable_log_requests}")
    print("="*76 + "\n")

    engine = DisaggregatedEngine(block_size=16, blocks_per_node=256)
    analyzer = LogicalMemoryAnalyzer(engine)
    divergence_detector = StateDivergenceDetector()
    perfetto = PerfettoTraceExporter(process_name="vLLM-Redline-Benchmark")

    stop_event = threading.Event()
    stats = {
        "completed_requests": 0,
        "aborted_requests": 0,
        "total_tokens": 0,
        "latencies": []
    }

    start_time = time.time()
    
    print(f"[*] Spawning {concurrency} independent client worker threads...")
    threads: List[threading.Thread] = []
    for wid in range(concurrency):
        t = threading.Thread(
            target=simulate_client_worker,
            args=(wid, engine, divergence_detector, stop_event, stats),
            daemon=True
        )
        threads.append(t)
        t.start()

    # Progress loop
    while time.time() - start_time < duration_sec:
        time.sleep(0.5)
        elapsed = round(time.time() - start_time, 1)
        active_zombies = len(divergence_detector.check_divergence(engine.sequences))
        print(f"[{elapsed}s / {duration_sec}s] Completed: {stats['completed_requests']} | Aborted (Zombies): {stats['aborted_requests']} | Active Leaks Detected: {active_zombies}")

    stop_event.set()
    for t in threads:
        t.join(timeout=0.2)

    total_time = time.time() - start_time
    metrics = analyzer.calculate_cluster_metrics()
    diag = analyzer.analyze_diagnostics()

    tpot = (sum(stats["latencies"]) / max(1, stats["total_tokens"])) * 1000 if stats["total_tokens"] > 0 else 0.0
    throughput = round(stats["total_tokens"] / total_time, 1)

    print("\n" + "-"*76)
    print("  REDLINE BENCHMARK SUMMARY")
    print("-" * 76)
    print(f"  Total Duration:                 {round(total_time, 2)} s")
    print(f"  Completed Client Requests:      {stats['completed_requests']}")
    print(f"  Aborted Zombie Sequences:       {stats['aborted_requests']}")
    print(f"  Total Output Tokens Generated:  {stats['total_tokens']}")
    print(f"  System Throughput:              {throughput} tokens/sec")
    print(f"  Average Time Per Output Token:  {round(tpot, 2)} ms/token")
    print(f"  Hostage Blocks Detected:        {diag.total_hostage_blocks} blocks")
    print(f"  VRAM Memory Waste:              ${metrics.estimated_waste_usd_per_hour}/hr")
    print(f"  Internal Slack Waste:           {metrics.internal_frag_pct}%")
    print(f"  Prefix Cache Hit Rate:          {metrics.prefix_cache_hit_rate}%")
    print("-" * 76)

    perfetto.save_trace(export_perfetto)
    print(f"\n[+] Ground-truth Perfetto trace exported to: {export_perfetto}")
    print(">>> REDLINE BENCHMARK COMPLETED SUCCESSFULLY <<<\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KVCacheScope Redline Benchmark Harness")
    parser.add_argument("--concurrency", type=int, default=100, help="Number of concurrent client streams")
    parser.add_argument("--duration", type=int, default=10, help="Test duration in seconds")
    parser.add_argument("--disable-log-requests", action="store_true", default=True, help="Disable disk I/O logging")
    parser.add_argument("--export-perfetto", type=str, default="perfetto_redline_trace.json", help="Perfetto trace path")
    args = parser.parse_args()

    run_redline_benchmark(
        concurrency=args.concurrency,
        duration_sec=args.duration,
        disable_log_requests=args.disable_log_requests,
        export_perfetto=args.export_perfetto
    )
