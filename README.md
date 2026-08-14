# kvcachescope

A logical memory profiler and state inspector for PagedAttention inference engines (vLLM, SGLang).

Standard GPU profilers (`nvidia-smi`, `nsys`, `torch.cuda.memory_allocated()`) observe physical VRAM allocations at the PyTorch tensor level. They cannot inspect the internal logical block tables, virtual token indices, reference counts, or prefix caching radix trees maintained inside an inference engine's memory manager.

When an ungraceful client disconnect occurs, or when fragmented decode sequences hold tail blocks without allocation activity, physical memory stays allocated. `kvcachescope` hooks directly into the engine's `BlockSpaceManager` to provide real-time visibility into the logical-to-physical block mapping, flag state divergence between HTTP sessions and backend GPU allocations, and detect unreleased blocks in CI pipelines.

---

## Architecture

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
|  |  - allocate()                |  |                           |
|  |  - free()                    |  | Telemetry Hook            | State Divergence
|  |  - append_slots()            |==+==========================>| Checks
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

## Quickstart

### 1. Standalone Dashboard / Simulator

Run the profiler with the built-in PagedAttention simulation engine:

```bash
git clone https://github.com/brian-mwirigi/kvcachescope.git
cd kvcachescope
pip install -r requirements.txt
python run.py
```

Dashboard starts at `http://localhost:8000`.

### 2. Live vLLM Engine Hook

Attach `kvcachescope` to an active vLLM engine instance:

```python
from vllm import LLMEngine, EngineArgs
from backend.vllm_hook import attach_vllm_hook

# Initialize standard vLLM engine
engine_args = EngineArgs(model="facebook/opt-125m", enable_prefix_caching=True)
engine = LLMEngine.from_engine_args(engine_args)

# Attach observer hook (runs in isolated daemon thread)
hook = attach_vllm_hook(engine, port=8000)
```

The hook instruments `BlockSpaceManager.allocate()`, `free()`, `append_slots()`, and samples `block_tables` at 10Hz without modifying model forward passes.

---

## Workflows & Use Cases

### 1. Diagnosing Production VRAM Leaks (Zero Pod Restarts)
When a continuous batching cluster hits 98% VRAM utilization and stalls, `nvidia-smi` reports all memory as allocated by Python. Attach `kvcachescope` to the running engine:
```python
from backend.vllm_hook import attach_vllm_hook
hook = attach_vllm_hook(llm_engine, port=8000)
```
Open `http://localhost:8000` to inspect the **Hostage Block & Zombie Hunter**. If an ungraceful client disconnect left physical blocks locked, identify the exact sequence ID and call the reclaim endpoint (`POST /api/diagnostics/reclaim`) to restore the free queue without restarting the model pod.

### 2. Automated CI/CD Regression Defense
Add leak regression assertions to your GitHub Actions test suite:
```yaml
- name: KV Cache Memory Leak Assertion
  run: |
    python run.py --ci-mode --duration-sec 60 --max-zombie-tolerance 0 --max-frag-tolerance 35.0 --report-json ci_report.json
```
If a PR introduces reference count leaks or orphaned block allocations, the job automatically fails with exit code `1` and exports detailed diagnostics.

### 3. Tuning Block Sizes & Measuring Tail Slack Space
When serving short-output agent loops (1–3 output tokens), large physical block sizes cause high internal slack waste. Benchmark your target traffic:
```bash
python benchmarks/benchmark_redline.py --concurrency 50 --duration 30
```
Inspect the **Internal Slack Waste %** metric to evaluate whether switching from 32-token to 16-token or 8-token block sizes recovers VRAM capacity for higher batch concurrency.

### 4. Ground-Truth Hardware Alignment with Perfetto
Export microsecond-precision block lifecycle traces:
```bash
python backend/stress_test_suite.py --vector all --export-perfetto trace.json
```
Load `trace.json` into [ui.perfetto.dev](https://ui.perfetto.dev/) alongside native `torch.profiler` CUDA traces (`VLLM_TORCH_PROFILER_DIR`) to verify chronological alignment between PagedAttention block deallocations and physical CUDA memory frees.

### 5. Interactive Cloud GPU Testing in Google Colab
Launch on cloud GPUs with zero network tunnels using [`notebooks/KVCacheScope_Live_vLLM_Colab.ipynb`](notebooks/KVCacheScope_Live_vLLM_Colab.ipynb). The notebook applies `nest_asyncio` and exposes the UI in a native window via `output.serve_kernel_port_as_window(8000)`.

---

## Failure Modes Observed

### 1. Asynchronous Client Disconnect Leak (`CancelledError` Divergence)
When an HTTP client connection terminates mid-generation (proxy timeout, client abort), ASGI servers raise `asyncio.CancelledError`. In some engine configurations, the frontend marks the request terminated but fails to dispatch `abort_request()` across the IPC boundary to the GPU worker.

The worker continues autoregressive token decoding (often at ~7-8 tokens/sec) until reaching `max_tokens`. `StateDivergenceDetector` cross-correlates frontend session registries with backend physical block tables to flag active token generation on closed sessions.

### 2. Scheduler Capacity Deadlock (99.1% VRAM Watermark)
When `gpu_memory_utilization` is configured near physical capacity (>=0.99) alongside high `max_num_seqs`, preemption edge cases in the scheduler can cause the main generation loop to deadlock while VRAM remains 99% full.

`kvcachescope`'s observer executes on a decoupled daemon thread with lock-free atomic snapshot swaps, allowing telemetry streaming and sequence starvation reporting to continue even if the engine scheduler hangs.

### 3. Prefix Cache Refcount Cycles
In multimodal or long system prompt workloads, Python-level cyclical references around shared prefix nodes can prevent garbage collection from destroying wrapper objects upon request termination. C++ block destructors are never invoked, leaving physical blocks with `ref_count > 0` indefinitely.

### 4. Tail-Block Slack Space
PagedAttention allocates fixed-size physical blocks (default: 16 tokens). In high-concurrency short-output workloads (e.g., 1-token tool calls or routing classifications), allocating a full 16-token block for 1 token leaves 15 unused slots (93.7% internal slack waste).

---

## Headless CI/CD Testing

Run automated memory leak assertions in GitHub Actions or test suites:

```bash
python run.py --ci-mode --duration-sec 30 --max-zombie-tolerance 0 --max-frag-tolerance 40.0 --report-json ci_report.json
```

- Returns exit code `0` if all assertions pass.
- Returns exit code `1` if unreleased hostage blocks or fragmentation thresholds are breached.
- Writes structured results to `ci_report.json`.

---

## Stress Testing Suite

Execute the 5-vector failure matrix:

```bash
python backend/stress_test_suite.py --vector all
```

Individual vectors:
- `python backend/stress_test_suite.py --vector abort_divergence` (Client disconnect vs backend worker)
- `python backend/stress_test_suite.py --vector deadlock_99` (99.1% VRAM watermark lockup)
- `python backend/stress_test_suite.py --vector prefix_cycle` (Multimodal prefix refcount leaks)
- `python backend/stress_test_suite.py --vector speculative_thrash` (Dual-model rollback micro-allocations)
- `python backend/stress_test_suite.py --vector hw_abstraction` (CUDA, ROCm, OpenVINO, QAic)

---

## High-Concurrency Benchmark Harness

Run multi-threaded client load to test GPU saturation without hitting the Python asyncio client bottleneck (>50 streams):

```bash
python benchmarks/benchmark_redline.py --concurrency 50 --duration 10 --disable-log-requests
```

Exports a microsecond-precision trace file (`perfetto_redline_trace.json`) that can be loaded directly into [ui.perfetto.dev](https://ui.perfetto.dev/) for side-by-side alignment with `torch.profiler`.

---

## Google Colab

A notebook demonstrating live vLLM profiling with `nest_asyncio` and Colab's native window port forwarding is in [`notebooks/KVCacheScope_Live_vLLM_Colab.ipynb`](notebooks/KVCacheScope_Live_vLLM_Colab.ipynb).

```python
import nest_asyncio
nest_asyncio.apply()

from google.colab import output
output.serve_kernel_port_as_window(8000)
```

---

## CLI Options

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

## License

Apache-2.0
