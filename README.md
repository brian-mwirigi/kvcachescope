<div align="center">

# KVCacheScope

**Logical Memory Profiler & Zombie Leak Defense for PagedAttention Inference Engines**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python](https://img.shields.io/badge/python-3.9%20%7C%203.10%20%7C%203.11%20%7C%203.12-blue)](https://www.python.org/)
[![Target Engines](https://img.shields.io/badge/engines-vLLM%20%7C%20SGLang%20%7C%20Disaggregated%20KV-orange)](https://github.com/vllm-project/vllm)
[![Tracing](https://img.shields.io/badge/tracing-Perfetto%20%7C%20Chrome%20DevTools-green)](https://ui.perfetto.dev/)
[![CI Status](https://img.shields.io/badge/CI-zero--zombie%20verified-success)](#automated-cicd-regression-defense)

*Standard GPU profilers observe physical VRAM. `kvcachescope` inspects the engine's logical brain.*

[Architecture](#architecture) • [Quickstart](#quickstart) • [Failure Modes](#production-failure-modes-observed) • [CI/CD Integration](#automated-cicd-regression-defense) • [Benchmarks](#high-concurrency-benchmarking)

</div>

---

## ⚡ Why KVCacheScope?

When continuous batching LLM servers stall or hit OOM (Out-of-Memory), standard tools like `nvidia-smi`, `nsys`, and `torch.cuda.memory_allocated()` only report aggregate VRAM usage. They are completely blind to user-space virtual memory management inside PagedAttention:

* ❌ **Zero Request-Level Attribution:** Cannot map physical GPU pages back to active sequence IDs.
* ❌ **Invisible Zombie Leaks:** If a client disconnects mid-stream, orphaned decode blocks remain trapped in the KV allocator while `nvidia-smi` reports them as active memory.
* ❌ **Undetected Slack Fragmentation:** 16-token or 32-token blocks holding only 1–2 tokens waste massive tail VRAM with zero visibility.
* ❌ **Refcount Cycle Traps:** Shared prefix nodes in multimodal or agent workflows fail to garbage collect, leaking GPU blocks silently over days.

**KVCacheScope** attaches a non-invasive 10Hz telemetry hook directly into the inference engine’s `BlockSpaceManager` and `PrefixCachingAllocator`, providing real-time cockpit visibility, automatic leak quarantine, and 1-click zero-restart block reclamation.

---

## 📊 The Observability Blindspot

| Metric / Capability | `nvidia-smi` / `nsys` | `torch.cuda.memory_*` | **`kvcachescope`** |
| :--- | :---: | :---: | :---: |
| **Physical VRAM Allocation** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Logical-to-Physical Block Mapping** | ❌ No | ❌ No | ✅ **Real-Time 2D Grid** |
| **Per-Sequence Memory Attribution** | ❌ No | ❌ No | ✅ **Live Sequence Inspector** |
| **Zombie / Orphaned Block Hunter** | ❌ No | ❌ No | ✅ **Automated Detection** |
| **Tail Block Slack Waste %** | ❌ No | ❌ No | ✅ **Granular Slot-Level Meter** |
| **Prefix Caching Radix Tree Refcounts**| ❌ No | ❌ No | ✅ **Full DAG / Tree Telemetry** |
| **Zero-Pod-Restart Memory Reclaim** | ❌ No | ❌ No | ✅ **1-Click REST API Endpoint** |
| **Microsecond Perfetto Trace Export** | ⚠️ Partial (CUDA only) | ❌ No | ✅ **Full Logical Timeline** |

---

## 🏗️ Architecture

```
                                  +---------------------------------------------+
                                  |            kvcachescope Web UI              |
                                  |  - 2D Physical Block Grid Matrix            |
                                  |  - Virtual Token -> Block Table Visualizer  |
                                  |  - Hostage / Leaked Sequence Inspector      |
                                  +----------------------+----------------------+
                                                         ^
                                          10Hz WebSocket | /ws/stream
                                                         v
+------------------------------------+        +-------------------------------------+
|        Target LLM Engine           |        |         kvcachescope Server         |
|  (vLLM / SGLang / Disaggregated)   |        |  (FastAPI + Detached Observer Loop) |
|                                    |        +-------------------------------------+
|  +------------------------------+  |                           |
|  |     BlockSpaceManager        |  |                           |
|  |  - allocate()                |  | Telemetry Hook            | State Divergence
|  |  - free()                    |  | (10Hz Non-invasive)       | Checks
|  |  - append_slots()            |==+==========================>|
|  |  - block_tables              |  |                           |
|  +------------------------------+  |                           v
|                                    |        +-------------------------------------+
|  +------------------------------+  |        |      CI / Regression Runner         |
|  |   PrefixCachingAllocator     |  |        |  - Zero-zombie tolerance assertions |
|  |  - radix_tree refcounts      |  |        |  - Perfetto trace export (.json)    |
|  +------------------------------+  |        +-------------------------------------+
+------------------------------------+
```

---

## 🚀 Quickstart

### 1. Standalone Cockpit / Simulator

Launch the profiler with the built-in PagedAttention workload generator and interactive UI:

```bash
# Clone & install
git clone https://github.com/brian-mwirigi/kvcachescope.git
cd kvcachescope
pip install -r requirements.txt

# Run the dashboard
python run.py
```
*Open **`http://localhost:8000`** in your browser to view the live dashboard.*

---

### 2. Live vLLM Engine Hook

Attach `kvcachescope` directly to your production vLLM instance without touching model weights or forward passes:

```python
from vllm import LLMEngine, EngineArgs
from backend.vllm_hook import attach_vllm_hook

# Initialize standard vLLM engine
engine_args = EngineArgs(
    model="facebook/opt-125m",
    enable_prefix_caching=True,
    gpu_memory_utilization=0.90
)
engine = LLMEngine.from_engine_args(engine_args)

# Attach KVCacheScope observer (runs in detached background daemon)
hook = attach_vllm_hook(engine, port=8000)
```

The hook instruments `BlockSpaceManager.allocate()`, `free()`, and `append_slots()` with atomic, lock-free snapshots.

---

### 3. Google Colab (Zero Port-Forwarding Setup)

Run live vLLM profiling in Google Colab using [`notebooks/KVCacheScope_Live_vLLM_Colab.ipynb`](notebooks/KVCacheScope_Live_vLLM_Colab.ipynb):

```python
import nest_asyncio
nest_asyncio.apply()

from google.colab import output
output.serve_kernel_port_as_window(8000)
```

---

## 🔬 Production Failure Modes Observed

### 1. Asynchronous Client Disconnect Leak (`CancelledError` Divergence)
When an upstream client terminates an HTTP connection (timeout, tab close), ASGI servers trigger `asyncio.CancelledError`. If the serving framework fails to dispatch `abort_request()` across the IPC boundary to the GPU worker, the worker continues autoregressive token decoding until hitting `max_tokens`.
* **KVCacheScope Detection:** `StateDivergenceDetector` cross-references frontend session tables against GPU block allocations, flagging running sequences that have no live client.

### 2. Scheduler Capacity Deadlock (99.1% VRAM Watermark)
When `gpu_memory_utilization` is configured near physical capacity (`>= 0.99`) with high `max_num_seqs`, preemption thrashing can deadlock the engine scheduler while VRAM stays 99% locked.
* **KVCacheScope Detection:** The decoupled observer daemon bypasses the engine thread to continuously stream starvation metrics and block states even when the main scheduler hangs.

### 3. Prefix Cache Refcount Cycles
In multimodal or long system-prompt workloads, circular references in Python wrapper objects can prevent garbage collection upon sequence completion. Block destructors are skipped, stranding physical blocks with `ref_count > 0`.
* **KVCacheScope Detection:** Live reference count tracker inspects every node in the prefix radix DAG and isolates orphaned non-zero refcount blocks.

### 4. Tail-Block Slack Space Fragmentation
PagedAttention allocates fixed-size physical blocks (e.g., 16 tokens). In high-concurrency short-output workloads (e.g., 1-token classification or agent tool routing), allocating 16 tokens for 1 token leaves 15 unused slots (93.7% internal slack waste).
* **KVCacheScope Detection:** The Slack Waste Analyzer computes active vs. allocated slot efficiency per sequence in real time.

---

## 🛡️ Automated CI/CD Regression Defense

Prevent memory leaks and fragmentation regressions from entering production by adding headless assertions to your CI pipelines:

```bash
python run.py \
  --ci-mode \
  --duration-sec 30 \
  --max-zombie-tolerance 0 \
  --max-frag-tolerance 40.0 \
  --report-json ci_report.json
```

### GitHub Actions Workflow Example

```yaml
name: KV Cache Leak Defense

on: [push, pull_request]

jobs:
  kv-leak-assertion:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.10"
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run Zero-Zombie Memory Leak Assertion
        run: |
          python run.py --ci-mode --duration-sec 45 --max-zombie-tolerance 0 --report-json ci_report.json
      - name: Upload Test Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: kv-cache-ci-report
          path: ci_report.json
```

*Exit code `0` on pass; exit code `1` if memory leaks or fragmentation thresholds are breached.*

---

## 🧪 5-Vector Stress Matrix

Run the comprehensive failure validation matrix to stress-test your inference infrastructure:

```bash
# Run all 5 stress testing vectors
python backend/stress_test_suite.py --vector all --export-perfetto trace.json
```

| Vector | Failure Mode Tested | Assertion Target |
| :--- | :--- | :--- |
| `abort_divergence` | Client disconnect vs backend worker | Detects uncoordinated token generation |
| `deadlock_99` | 99.1% VRAM watermark lockup | Verifies deadlock-free observer survival |
| `prefix_cycle` | Multimodal prefix refcount leaks | Flags orphaned non-zero refcounts |
| `speculative_thrash`| Dual-model rollback micro-allocations | Tracks rollback deallocation consistency |
| `hw_abstraction` | Multi-backend hardware memory | Cross-device memory allocator parity |

---

## 📈 Perfetto Trace Export

Export microsecond-precision block lifecycle events directly into Chrome DevTools / Perfetto:

```bash
python run.py --stress-suite --export-perfetto perfetto_trace.json
```

1. Open **[ui.perfetto.dev](https://ui.perfetto.dev/)**.
2. Drag and drop `perfetto_trace.json`.
3. Align PagedAttention logical allocations chronologically against native `torch.profiler` CUDA traces (`VLLM_TORCH_PROFILER_DIR`).

---

## 🏎️ High-Concurrency Benchmarking

Run high-throughput stress workloads to measure block allocation speed and internal slack:

```bash
python benchmarks/benchmark_redline.py --concurrency 50 --duration 15 --disable-log-requests
```

---

## ⚙️ CLI Reference

```text
usage: run.py [-h] [--ci-mode] [--duration-sec DURATION_SEC]
              [--max-zombie-tolerance MAX_ZOMBIE_TOLERANCE]
              [--max-frag-tolerance MAX_FRAG_TOLERANCE]
              [--scenario SCENARIO] [--report-json REPORT_JSON]
              [--stress-suite]
              [--stress-vector {abort_divergence,deadlock_99,prefix_cycle,speculative_thrash,hw_abstraction}]
              [--export-perfetto EXPORT_PERFETTO] [--port PORT]
              [--host HOST] [--no-browser]

KVCacheScope: Logical KV Cache Profiler & Inspector

options:
  -h, --help            Show this help message and exit
  --ci-mode             Run in headless CI/CD mode and exit with test status
  --duration-sec SEC    Duration for CI test run (default: 15)
  --max-zombie-tolerance N
                        Max allowed zombie/hostage blocks (default: 0)
  --max-frag-tolerance PCT
                        Max internal fragmentation percentage (default: 50.0)
  --scenario NAME       Initial workload scenario (default: normal_traffic)
  --report-json PATH    Path to export CI report JSON (default: ci_report.json)
  --stress-suite        Run full 5-vector stress matrix
  --export-perfetto PATH
                        Export Perfetto trace timeline (default: perfetto_stress_matrix_trace.json)
  --port PORT           Port to serve dashboard (default: 8000)
  --host HOST           Host address to bind (default: 0.0.0.0)
  --no-browser          Do not auto-open browser on startup
```

---

## 📄 License

Distributed under the **Apache 2.0 License**. See [`LICENSE`](LICENSE) for more details.
