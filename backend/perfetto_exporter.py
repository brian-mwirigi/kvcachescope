"""
KVCacheScope Perfetto & Chrome Trace Ground-Truth Exporter
==========================================================
Exports microsecond-precision timeline traces of physical GPU block allocations,
refcount transitions, and divergence events for visualization in https://ui.perfetto.dev/
and chronological alignment with native torch.profiler traces.
"""

import json
import time
from typing import List, Dict, Any, Optional

class PerfettoTraceExporter:
    """
    Generates Chrome Trace Format events compatible with Perfetto UI.
    """
    def __init__(self, process_name: str = "vLLM-PagedAttention-Engine"):
        self.process_name = process_name
        self.events: List[Dict[str, Any]] = []
        self.base_time_us = int(time.time() * 1_000_000)

        # Metadata event
        self.events.append({
            "name": "process_name",
            "ph": "M",
            "pid": 1,
            "args": {"name": self.process_name}
        })
        self.events.append({
            "name": "thread_name",
            "ph": "M",
            "pid": 1,
            "tid": 1,
            "args": {"name": "KVCache-BlockAllocator"}
        })
        self.events.append({
            "name": "thread_name",
            "ph": "M",
            "pid": 1,
            "tid": 2,
            "args": {"name": "Divergence-LeakDetector"}
        })

    def log_block_allocation(self, block_id: int, seq_id: str, token_count: int, ts_us: Optional[int] = None):
        ts = ts_us or int(time.time() * 1_000_000)
        self.events.append({
            "name": f"Allocate_Block_{block_id}",
            "cat": "kv_cache,allocation",
            "ph": "X",  # Complete event
            "ts": ts,
            "dur": 25,  # 25us duration
            "pid": 1,
            "tid": 1,
            "args": {
                "block_id": block_id,
                "sequence_id": seq_id,
                "token_count": token_count
            }
        })

    def log_block_release(self, block_id: int, seq_id: str, ts_us: Optional[int] = None):
        ts = ts_us or int(time.time() * 1_000_000)
        self.events.append({
            "name": f"Free_Block_{block_id}",
            "cat": "kv_cache,deallocation",
            "ph": "X",
            "ts": ts,
            "dur": 15,
            "pid": 1,
            "tid": 1,
            "args": {
                "block_id": block_id,
                "sequence_id": seq_id
            }
        })

    def log_divergence_alert(self, req_id: str, zombie_duration_sec: float, blocks_held: int, ts_us: Optional[int] = None):
        ts = ts_us or int(time.time() * 1_000_000)
        self.events.append({
            "name": f"ZOMBIE_LEAK_ALERT_{req_id}",
            "cat": "divergence,error",
            "ph": "I", # Instant event
            "ts": ts,
            "pid": 1,
            "tid": 2,
            "s": "p",  # process scope
            "args": {
                "request_id": req_id,
                "zombie_duration_sec": zombie_duration_sec,
                "blocks_held": blocks_held,
                "root_cause": "Async CancelledError Backend Drop"
            }
        })

    def save_trace(self, file_path: str = "perfetto_kv_trace.json"):
        payload = {
            "traceEvents": self.events,
            "displayTimeUnit": "ms"
        }
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        return file_path
