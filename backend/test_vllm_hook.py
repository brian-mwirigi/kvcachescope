import unittest
from backend.vllm_hook import KVCacheScopeVLLMHook

class MockTokenBlock:
    def __init__(self, block_number: int, ref_count: int = 1):
        self.block_number = block_number
        self.ref_count = ref_count

class MockBlockSpaceManager:
    def __init__(self):
        self.block_tables = {
            "seq_101": [MockTokenBlock(0, ref_count=2), MockTokenBlock(1, ref_count=1), MockTokenBlock(2, ref_count=1)],
            "seq_102": [MockTokenBlock(0, ref_count=2), MockTokenBlock(3, ref_count=1)],
        }
        self.gpu_allocator = type("Allocator", (), {"num_blocks": 64})()

    def allocate(self, *args, **kwargs):
        return True

    def free(self, *args, **kwargs):
        return True

class TestVLLMHook(unittest.TestCase):
    def test_hook_attachment_and_snapshot(self):
        mgr = MockBlockSpaceManager()
        hook = KVCacheScopeVLLMHook(block_size=16, node_id="test_vllm_gpu")
        hook.attach_to_block_space_manager(mgr)

        self.assertTrue(hook.is_attached)
        self.assertEqual(hook.total_gpu_blocks, 64)

        snapshot = hook.extract_live_snapshot()
        self.assertIsNotNone(snapshot)
        self.assertIn("test_vllm_gpu", snapshot.nodes)
        
        # Verify block 0 is marked PREFIX_SHARED (refcount 2)
        node_blocks = snapshot.blocks_by_node["test_vllm_gpu"]
        blk_0 = next(b for b in node_blocks if b.block_id == 0)
        self.assertEqual(blk_0.state.value, "PREFIX_SHARED")
        self.assertEqual(blk_0.ref_count, 2)
        self.assertEqual(len(blk_0.sequence_ids), 2)

        # Verify sequence tables
        self.assertIn("seq_101", snapshot.sequences)
        self.assertEqual(snapshot.sequences["seq_101"].logical_blocks, [0, 1, 2])

if __name__ == "__main__":
    unittest.main()
