# KVCacheScope 🔍⚡
### Logical KV Cache Profiler & Failure Defense System for PagedAttention & Disaggregated LLM Inference

[![CI Regression Suite](https://github.com/vllm-project/kvcachescope/actions/workflows/ci.yml/badge.svg)](https://github.com/vllm-project/kvcachescope)
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/vllm-project/kvcachescope/blob/main/notebooks/KVCacheScope_Live_vLLM_Colab.ipynb)
![PagedAttention](https://img.shields.io/badge/PagedAttention-vLLM%20%7C%20SGLang%20%7C%20TRT--LLM-cyan)
![Platform](https://img.shields.io/badge/Architecture-Disaggregated%20Prefill%2FDecode-blue)
![Diagnostics](https://img.shields.io/badge/StateDivergenceDetector-Zombie%20Leak%20Detection-rose)
![Perfetto Ground Truth](https://img.shields.io/badge/Perfetto-Microsecond%20Trace%20Aligned-emerald)

---

## 🎯 The Problem: Operational Opacity in Virtualized Memory

PagedAttention virtualizes the Key-Value (KV) cache into fixed-size physical blocks (typically 16–32 tokens), eliminating contiguous memory allocation limits and cutting physical external fragmentation below 4%.

However, standard GPU profilers (`nsys`, `pmap`, `Heaptrack`, `nvidia-smi`) only observe **flat, physical VRAM allocations**. They are blind to:
1. **Hostage & Zombie Block Leaks**: Ungraceful client disconnects (`asyncio.CancelledError`) where the frontend drops the connection, but the backend execution worker continues generating tokens silently at ~7.8 tok/s.
2. **Internal Slack Space Saturation**: High concurrency of short 1-token responses leaving up to 93.7% slack waste within allocated blocks.
3. **Prefix Caching RefCount Cycles**: Complex Python wrapper object reference cycles preventing garbage collection from calling C++ block destructors.
4. **99.1% VRAM Scheduler Deadlocks**: Schedulers hanging at extreme memory watermarks under continuous batching load.

```
+-----------------------------------------------------------------------------------------+
|                                    KVCacheScope                                         |
|                                                                                         |
|  +---------------------------+     10Hz WS Stream     +------------------------------+  |
|  |   vLLM BlockSpaceManager  | =====================> |  2D GPU Block Matrix (UI)    |  |
|  | - allocate() / free()     |                        |  - Live Physical Block IDs   |  |
|  | - append_slots()          |                        |  - Radix Shared Refcounts    |  |
|  | - block_tables dict       |                        |  - Hostage / Leaked Blocks   |  |
|  +---------------------------+                        +------------------------------+  |
|               |                                                      |                  |
|               v                                                      v                  |
|  +---------------------------+                        +------------------------------+  |
|  | Headless CI/CD Runner     |                        | Hostage Zombie Hunter        |  |
|  | --max-zombie-tolerance 0  |                        | - StateDivergenceDetector    |  |
|  | (Exit 0=Pass / 1=Fail)    |                        | - 1-Click Pool Remediation   |  |
|  +---------------------------+                        +------------------------------+  |
+-----------------------------------------------------------------------------------------+
```

---

## 🚀 Key Innovations & Features

### 1. Live Non-Invasive vLLM `BlockSpaceManager` Hook
- Hooks directly into `allocate()`, `free()`, and `append_slots()`.
- Isolated observer daemon thread with lock-free atomic snapshot swapping (immune to engine scheduler stalls).
- One-line Python integration:
```python
from backend.vllm_hook import attach_vllm_hook

# Instruments any running vLLM engine instance
hook = attach_vllm_hook(llm_engine, port=8000)
```

### 2. State Divergence Detector (Zombie Leak Hunter)
- Cross-correlates frontend HTTP client stream state against physical GPU block tables.
- Flags ungraceful client drops and models estimated hourly VRAM waste ($/hr).
- 1-click remediation to purge hostage sequences or defragment nodes.

### 3. Headless CI/CD Regression Defense
- Zero-tolerance regression testing for continuous integration pipelines:
```bash
python run.py --ci-mode --duration-sec 30 --max-zombie-tolerance 0 --max-frag-tolerance 40.0 --report-json ci_report.json
```
- Exits with return code `0` on clean runs or `1` on memory leak detection.

### 4. High-Throughput Redline Benchmark Harness
- Multi-threaded load generator bypassing the Python asyncio 50-client saturation crash.
- Eliminates disk I/O bottlenecks via `--disable-log-requests`, sustaining **44,000+ tokens/sec**.

### 5. Perfetto Microsecond Trace Synchronization
- Exports Chrome Trace JSON (`perfetto_redline_trace.json`) with microsecond timestamps.
- Chronologically aligned with native `torch.profiler` (`VLLM_TORCH_PROFILER_DIR`) in [ui.perfetto.dev](https://ui.perfetto.dev/).

---

## 📦 Quick Start

### 1. Run Interactive Web Dashboard
```bash
python run.py
```
Open `http://localhost:8000` to inspect live physical GPU memory pools, virtual-to-physical block tables, and disaggregated routing topology.

### 2. Run Google Colab Notebook
Open [`notebooks/KVCacheScope_Live_vLLM_Colab.ipynb`](notebooks/KVCacheScope_Live_vLLM_Colab.ipynb) with `nest_asyncio` and native Colab window port forwarding:
```python
import nest_asyncio
nest_asyncio.apply()

from google.colab import output
output.serve_kernel_port_as_window(8000)
```

---

## 🧪 5-Step Redline Stress Matrix Validation

Execute the full stress matrix covering the 5 canonical inference failure modes:
```bash
python backend/stress_test_suite.py --vector all
```

| Vector | Failure Mode Tested | Assertion | Result |
|---|---|---|---|
| **1. Zombie Leak** | Client drop (`CancelledError`) not sent to GPU worker | `divergences_detected == canceled_requests` | `[PASS]` |
| **2. 99.1% Deadlock** | Scheduler stall under extreme VRAM saturation | Observer thread survives at 10Hz | `[PASS]` |
| **3. Prefix Cycle** | Multimodal Python GC reference cycle leak | Tracks shared block refcount decrements | `[PASS]` |
| **4. Speculative Thrash** | Dual-model $K=5$ draft rollbacks | Microsecond transient rollback capture | `[PASS]` |
| **5. Hardware Abstraction** | CUDA, ROCm (CK), OpenVINO (RAM), QAic (AOT) | Platform abstraction mapping | `[PASS]` |

---

## 🛠️ CLI Reference

```
usage: run.py [-h] [--ci-mode] [--duration-sec DURATION_SEC]
              [--max-zombie-tolerance MAX_ZOMBIE_TOLERANCE]
              [--max-frag-tolerance MAX_FRAG_TOLERANCE]
              [--scenario SCENARIO] [--report-json REPORT_JSON]
              [--stress-suite] [--stress-vector {abort_divergence,deadlock_99,prefix_cycle,speculative_thrash,hw_abstraction}]
              [--export-perfetto EXPORT_PERFETTO] [--port PORT]
              [--host HOST] [--no-browser]
```

---

## 📊 Benchmark Summary

```
============================================================================
  KVCacheScope High-Concurrency Redline Benchmark Harness
============================================================================
  Concurrency Level:      50 concurrent streams (Multi-threaded)
  Total Duration:         5.18 s
  Completed Requests:     3,841 requests
  Aborted Zombies:        426 sequences detected & isolated
  Total Tokens Generated: 228,732 tokens
  System Throughput:      44,169.3 tokens/sec
  Hostage Blocks Flagged: 1,005 blocks
  Perfetto Trace File:    perfetto_redline_trace.json
============================================================================
```

---

## 📄 License
Apache-2.0. Built for the open-source high-throughput LLM inference ecosystem.
