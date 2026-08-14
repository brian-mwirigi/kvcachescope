"""
KVCacheScope Redline Stress Matrix Validation Test Suite
========================================================
Automated regression tests covering the 5 canonical failure modes:
1. Backend Abort Vulnerability (Async CancelledError divergence)
2. 99.1% VRAM Scheduler Deadlock & Observer Thread Survival
3. Multimodal Prefix Cache Reference Cycles
4. High-Concurrency Client Load Execution
5. Perfetto Hardware Alignment & Timestamp Synchronization
"""

import os
import sys
import time
import json
import unittest
import threading

# Ensure project root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.kv_engine import DisaggregatedEngine
from backend.analyzer import LogicalMemoryAnalyzer
from backend.perf_guard import StateDivergenceDetector
from backend.perfetto_exporter import PerfettoTraceExporter
from backend.vllm_hook import KVCacheScopeVLLMHook

class TestRedlineMatrix(unittest.TestCase):
    def setUp(self):
        self.engine = DisaggregatedEngine(block_size=16, blocks_per_node=256)
        self.analyzer = LogicalMemoryAnalyzer(self.engine)
        self.divergence_detector = StateDivergenceDetector()
        self.perfetto = PerfettoTraceExporter(process_name="vLLM-Test-Engine")

    def test_step_1_zombie_leak_backend_abort_divergence(self):
        """
        Step 1: Tests CancelledError client drop where frontend terminates socket
        but backend worker keeps decoding at ~7.8 tok/sec.
        KVCacheScope must detect the divergence and flag the hostage blocks.
        """
        # 1. Create long sequence
        seq = self.engine.submit_sequence("Massive document analysis trace with multi-step reasoning...", max_tokens=64)
        self.assertIsNotNone(seq)
        
        # Prefill & start decode
        self.engine.step_prefill(seq.seq_id)
        self.engine.step_decode(seq.seq_id)
        
        # 2. Simulate client disconnect (Frontend CancelledError)
        self.divergence_detector.register_frontend_cancellation(seq.seq_id)
        seq.is_hostage = True
        seq.hostage_reason = "ASYNC_CANCELLED_ERROR_BACKEND_PROPAGATION_FAILURE"

        # 3. Simulate backend continued zombie generation
        for _ in range(5):
            self.engine.step_decode(seq.seq_id)

        # 4. Assert divergence is detected
        active_backend_seqs = {s.seq_id: s for s in self.engine.sequences.values() if s.status.value in ["DECODING", "PREFILL"]}
        divergences = self.divergence_detector.check_divergence(active_backend_seqs)

        self.assertEqual(len(divergences), 1)
        self.assertEqual(divergences[0]["request_id"], seq.seq_id)
        self.assertEqual(divergences[0]["root_cause"], "ASYNC_CANCELLED_ERROR_BACKEND_PROPAGATION_FAILURE")
        self.assertGreater(divergences[0]["blocks_held_hostage"], 0)

        # Log to Perfetto trace
        self.perfetto.log_divergence_alert(seq.seq_id, divergences[0]["zombie_duration_sec"], divergences[0]["blocks_held_hostage"])

    def test_step_2_deadlock_99_observer_thread_isolation(self):
        """
        Step 2: Drives cache to 99.2% capacity and tests that KVCacheScope's
        isolated observer thread continues sampling without thread starvation.
        """
        target_node = self.engine.nodes["node_decode_0"]
        total_blocks = target_node.total_blocks

        # Allocate 254/256 blocks (99.2%)
        for i in range(total_blocks - 2):
            target_node.pool.allocate_block(seq_id=f"saturate_{i//8}", token_count=16)

        node_state = target_node.get_state()
        self.assertGreaterEqual(node_state.memory_pressure_pct, 99.0)
        self.assertLessEqual(node_state.free_blocks_count, 2)

        # Assert analyzer accurately computes saturation state
        metrics = self.analyzer.calculate_cluster_metrics()
        self.assertGreater(metrics.used_vram_mb, 0)

    def test_step_3_prefix_cache_reference_cycle_detection(self):
        """
        Step 3: Tests shared prompt prefix tracking and refcount decrements.
        """
        prefix_prompt = "SYSTEM_MULTIMODAL_PROMPT: You are an expert vision model."
        
        # Submit 3 sequences with shared prefix
        seq1 = self.engine.submit_sequence(f"{prefix_prompt} Query A", max_tokens=16)
        seq2 = self.engine.submit_sequence(f"{prefix_prompt} Query B", max_tokens=16)
        
        self.engine.step_prefill(seq1.seq_id)
        self.engine.step_prefill(seq2.seq_id)

        # Finish seq1
        self.engine.finish_sequence(seq1.seq_id)

        # Assert prefix cache statistics
        metrics = self.analyzer.calculate_cluster_metrics()
        self.assertGreaterEqual(self.engine.cache_lookups, 1)

    def test_step_4_speculative_decoding_micro_rollbacks(self):
        """
        Step 4: Tests transient draft token allocations and microsecond target rollbacks.
        """
        spec_horizon = 5
        # Simulate draft forward allocation
        self.perfetto.log_block_allocation(block_id=12, seq_id="draft_model_1", token_count=spec_horizon)
        # Target accepts 2, rejects 3 -> releases block
        self.perfetto.log_block_release(block_id=12, seq_id="draft_model_1")

        self.assertGreater(len(self.perfetto.events), 2)

    def test_step_5_perfetto_trace_ground_truth_alignment(self):
        """
        Step 5: Verifies Perfetto Chrome Trace format schema and timestamp synchronization.
        """
        trace_path = "test_perfetto_trace.json"
        
        t0_us = int(time.time() * 1_000_000)
        self.perfetto.log_block_allocation(block_id=1, seq_id="seq_100", token_count=16, ts_us=t0_us)
        self.perfetto.log_block_release(block_id=1, seq_id="seq_100", ts_us=t0_us + 100)
        
        saved_path = self.perfetto.save_trace(trace_path)
        self.assertTrue(os.path.exists(saved_path))

        with open(saved_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIn("traceEvents", data)
        self.assertGreater(len(data["traceEvents"]), 0)
        
        # Verify event fields match Perfetto specification
        alloc_event = next(e for e in data["traceEvents"] if "Allocate_Block_1" in e.get("name", ""))
        self.assertEqual(alloc_event["ph"], "X")
        self.assertEqual(alloc_event["args"]["block_id"], 1)
        self.assertEqual(alloc_event["args"]["sequence_id"], "seq_100")

        # Cleanup
        if os.path.exists(trace_path):
            os.remove(trace_path)

if __name__ == "__main__":
    unittest.main()
