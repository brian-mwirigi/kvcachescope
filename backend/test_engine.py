import unittest
import time
from backend.models import BlockState, SequenceStatus, WorkerRole
from backend.kv_engine import PhysicalBlockPool, PrefixRadixTree, WorkerNode, DisaggregatedEngine
from backend.analyzer import LogicalMemoryAnalyzer

class TestKVCacheEngine(unittest.TestCase):
    def setUp(self):
        self.engine = DisaggregatedEngine(block_size=16, blocks_per_node=32)
        self.analyzer = LogicalMemoryAnalyzer(self.engine)

    def test_block_allocation_and_release(self):
        pool = PhysicalBlockPool(node_id="test_node", total_blocks=10, block_size=16)
        self.assertEqual(len(pool.free_queue), 10)
        
        # Allocate block
        blk = pool.allocate_block(seq_id="seq_1", token_count=8, preview="test_prompt")
        self.assertIsNotNone(blk)
        self.assertEqual(blk.state, BlockState.ACTIVE)
        self.assertEqual(blk.ref_count, 1)
        self.assertEqual(blk.token_count, 8)
        self.assertEqual(blk.slack_tokens, 8)
        self.assertEqual(len(pool.free_queue), 9)

        # Append tokens
        success = pool.append_token(blk.block_id)
        self.assertTrue(success)
        self.assertEqual(blk.token_count, 9)
        self.assertEqual(blk.slack_tokens, 7)

        # Share block
        pool.share_block(blk.block_id, seq_id="seq_2")
        self.assertEqual(blk.ref_count, 2)
        self.assertEqual(blk.state, BlockState.PREFIX_SHARED)

        # Release first sequence
        pool.release_block(blk.block_id, seq_id="seq_1")
        self.assertEqual(blk.ref_count, 1)
        self.assertEqual(blk.state, BlockState.ACTIVE)
        self.assertEqual(len(pool.free_queue), 9)

        # Release second sequence -> returns to free queue
        pool.release_block(blk.block_id, seq_id="seq_2")
        self.assertEqual(blk.ref_count, 0)
        self.assertEqual(blk.state, BlockState.FREE)
        self.assertEqual(len(pool.free_queue), 10)

    def test_prefix_radix_cache(self):
        radix = PrefixRadixTree()
        chunk = "System prompt common prefix"
        prefix_hash = radix.compute_prefix_hash(chunk)
        
        radix.register_block(prefix_hash, "node_0", 5, chunk)
        cached_id = radix.lookup_prefix("node_0", prefix_hash)
        self.assertEqual(cached_id, 5)

        # Different node lookup returns None
        self.assertIsNone(radix.lookup_prefix("node_1", prefix_hash))

    def test_disaggregated_lifecycle(self):
        # Submit sequence
        seq = self.engine.submit_sequence("What is PagedAttention logical block memory management?", max_tokens=10)
        self.assertIsNotNone(seq)
        self.assertEqual(seq.status, SequenceStatus.WAITING)

        # Prefill step
        success = self.engine.step_prefill(seq.seq_id)
        self.assertTrue(success)
        # Should have migrated to a decode node
        self.assertEqual(seq.status, SequenceStatus.DECODING)
        self.assertTrue(seq.node_id.startswith("node_decode_"))
        self.assertGreater(len(seq.logical_blocks), 0)

        # Decode step
        for _ in range(5):
            self.engine.step_decode(seq.seq_id)
        
        self.assertGreaterEqual(seq.generated_tokens, 5)

        # Finish sequence
        self.engine.finish_sequence(seq.seq_id)
        self.assertEqual(seq.status, SequenceStatus.FINISHED)
        self.assertEqual(self.engine.total_completed_sequences, 1)

    def test_hostage_leak_and_reclamation(self):
        seq = self.engine.submit_sequence("Long running agent task query", max_tokens=20)
        self.engine.step_prefill(seq.seq_id)
        self.engine.step_decode(seq.seq_id)

        # Inject leak
        leaked_id = self.engine.inject_hostage_leak(seq.seq_id, reason="CLIENT_WS_CONNECTION_RESET")
        self.assertEqual(leaked_id, seq.seq_id)
        self.assertEqual(seq.status, SequenceStatus.ZOMBIE_LEAKED)
        self.assertTrue(seq.is_hostage)

        # Verify diagnostic report detects it
        diag = self.analyzer.analyze_diagnostics()
        self.assertEqual(len(diag.hostage_sequences), 1)
        self.assertEqual(diag.hostage_sequences[0].sequence_id, seq.seq_id)
        self.assertLess(diag.health_score, 100)

        # Reclaim hostage
        freed = self.engine.reclaim_hostage_sequence(seq.seq_id)
        self.assertGreater(freed, 0)
        self.assertFalse(seq.is_hostage)

        # Verify diagnostics are clean
        diag_after = self.analyzer.analyze_diagnostics()
        self.assertEqual(len(diag_after.hostage_sequences), 0)
        self.assertEqual(diag_after.health_score, 100)

if __name__ == "__main__":
    unittest.main()
