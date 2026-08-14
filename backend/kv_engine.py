import time
import random
import hashlib
from typing import List, Dict, Optional, Tuple, Set, Any
from collections import deque

from backend.models import (
    Block, BlockState, Sequence, SequenceStatus,
    WorkerRole, WorkerNodeState
)

class PhysicalBlockPool:
    def __init__(self, node_id: str, total_blocks: int = 256, block_size: int = 16):
        self.node_id = node_id
        self.total_blocks = total_blocks
        self.block_size = block_size
        self.blocks: Dict[int, Block] = {}
        self.free_queue: deque[int] = deque()
        
        # Initialize blocks
        for i in range(total_blocks):
            self.blocks[i] = Block(
                block_id=i,
                physical_id=i,
                node_id=node_id,
                state=BlockState.FREE,
                ref_count=0,
                token_count=0,
                capacity=block_size,
                sequence_ids=[],
                slack_tokens=0
            )
            self.free_queue.append(i)

    def allocate_block(self, seq_id: str, token_count: int = 0, prefix_hash: Optional[str] = None, preview: Optional[str] = None) -> Optional[Block]:
        if not self.free_queue:
            return None
        
        block_id = self.free_queue.popleft()
        block = self.blocks[block_id]
        block.state = BlockState.ACTIVE
        block.ref_count = 1
        block.token_count = min(token_count, self.block_size)
        block.sequence_ids = [seq_id]
        block.prefix_hash = prefix_hash
        block.tokens_preview = preview or f"tok_{seq_id[:4]}_{block_id}"
        block.allocated_at = time.time()
        block.last_accessed_at = time.time()
        block.is_tail_block = (block.token_count < self.block_size)
        block.slack_tokens = self.block_size - block.token_count if block.token_count > 0 else 0
        return block

    def share_block(self, block_id: int, seq_id: str) -> Optional[Block]:
        if block_id not in self.blocks:
            return None
        block = self.blocks[block_id]
        if seq_id not in block.sequence_ids:
            block.sequence_ids.append(seq_id)
            block.ref_count += 1
        block.state = BlockState.PREFIX_SHARED
        block.last_accessed_at = time.time()
        return block

    def release_block(self, block_id: int, seq_id: str) -> bool:
        if block_id not in self.blocks:
            return False
        block = self.blocks[block_id]
        if seq_id in block.sequence_ids:
            block.sequence_ids.remove(seq_id)
            block.ref_count = max(0, block.ref_count - 1)
        
        # If no sequences remain, return to free queue
        if block.ref_count == 0:
            block.state = BlockState.FREE
            block.sequence_ids = []
            block.token_count = 0
            block.prefix_hash = None
            block.tokens_preview = None
            block.allocated_at = None
            block.last_accessed_at = None
            block.is_tail_block = False
            block.slack_tokens = 0
            if block_id not in self.free_queue:
                self.free_queue.append(block_id)
            return True
        elif block.ref_count == 1:
            block.state = BlockState.ACTIVE
        return False

    def append_token(self, block_id: int) -> bool:
        if block_id not in self.blocks:
            return False
        block = self.blocks[block_id]
        if block.token_count < self.block_size:
            block.token_count += 1
            block.is_tail_block = (block.token_count < self.block_size)
            block.slack_tokens = self.block_size - block.token_count
            block.last_accessed_at = time.time()
            return True
        return False

    def get_fragmentation_stats(self) -> Tuple[float, float]:
        """Returns (internal_slack_pct, external_fragmentation_pct)"""
        allocated_blocks = [b for b in self.blocks.values() if b.state != BlockState.FREE]
        if not allocated_blocks:
            return 0.0, 0.0
        
        total_slack_tokens = sum(b.slack_tokens for b in allocated_blocks)
        total_capacity_allocated = len(allocated_blocks) * self.block_size
        internal_slack_pct = (total_slack_tokens / total_capacity_allocated * 100) if total_capacity_allocated > 0 else 0.0

        # External fragmentation: assesses non-contiguous blocks or inability to satisfy large burst allocations
        free_count = len(self.free_queue)
        if free_count == 0:
            external_frag_pct = 0.0
        else:
            # Measure free queue distribution disorder
            free_set = set(self.free_queue)
            contiguous_runs = 0
            in_run = False
            for i in range(self.total_blocks):
                if i in free_set:
                    if not in_run:
                        contiguous_runs += 1
                        in_run = True
                else:
                    in_run = False
            
            # High runs with low average run length indicates high external fragmentation
            max_possible_runs = (self.total_blocks // 2) + 1
            external_frag_pct = min(100.0, (contiguous_runs / max(1, max_possible_runs)) * 100 * (1 - free_count / self.total_blocks))

        return round(internal_slack_pct, 2), round(external_frag_pct, 2)


class PrefixRadixTree:
    """Manages shared prompt prefix block caching and deduplication"""
    def __init__(self):
        # Maps prefix hash -> (physical_block_id, token_content)
        self.cache: Dict[str, Dict[str, Any]] = {}

    def compute_prefix_hash(self, token_chunk: str) -> str:
        return hashlib.sha256(token_chunk.encode('utf-8')).hexdigest()[:12]

    def register_block(self, prefix_hash: str, node_id: str, block_id: int, token_chunk: str):
        self.cache[f"{node_id}:{prefix_hash}"] = {
            "node_id": node_id,
            "block_id": block_id,
            "token_chunk": token_chunk,
            "hits": 0,
            "registered_at": time.time()
        }

    def lookup_prefix(self, node_id: str, prefix_hash: str) -> Optional[int]:
        key = f"{node_id}:{prefix_hash}"
        if key in self.cache:
            self.cache[key]["hits"] += 1
            return self.cache[key]["block_id"]
        return None

    def invalidate_block(self, node_id: str, block_id: int):
        keys_to_del = [k for k, v in self.cache.items() if v["node_id"] == node_id and v["block_id"] == block_id]
        for k in keys_to_del:
            del self.cache[k]


class WorkerNode:
    def __init__(self, node_id: str, name: str, role: WorkerRole, total_blocks: int = 256, block_size: int = 16):
        self.node_id = node_id
        self.name = name
        self.role = role
        self.total_blocks = total_blocks
        self.block_size = block_size
        self.pool = PhysicalBlockPool(node_id, total_blocks, block_size)
        self.active_sequences: Dict[str, Sequence] = {}

    def get_state(self) -> WorkerNodeState:
        allocated = [b for b in self.pool.blocks.values() if b.state != BlockState.FREE]
        shared = [b for b in allocated if b.state == BlockState.PREFIX_SHARED]
        hostage = [b for b in allocated if b.state == BlockState.HOSTAGE_ZOMBIE]
        
        internal_frag, external_frag = self.pool.get_fragmentation_stats()
        memory_pressure = (len(allocated) / self.total_blocks) * 100

        return WorkerNodeState(
            node_id=self.node_id,
            name=self.name,
            role=self.role,
            total_blocks=self.total_blocks,
            block_size=self.block_size,
            allocated_blocks_count=len(allocated),
            free_blocks_count=len(self.pool.free_queue),
            shared_blocks_count=len(shared),
            hostage_blocks_count=len(hostage),
            memory_pressure_pct=round(memory_pressure, 1),
            internal_fragmentation_pct=internal_frag,
            external_fragmentation_pct=external_frag,
            active_sequence_ids=list(self.active_sequences.keys())
        )


class DisaggregatedEngine:
    def __init__(self, block_size: int = 16, blocks_per_node: int = 256):
        self.block_size = block_size
        self.blocks_per_node = blocks_per_node
        self.radix_cache = PrefixRadixTree()
        self.nodes: Dict[str, WorkerNode] = {}
        self.sequences: Dict[str, Sequence] = {}
        self.events: deque[Dict[str, Any]] = deque(maxlen=50)
        self.total_completed_sequences = 0
        self.cache_lookups = 0
        self.cache_hits = 0
        self.is_running = True
        self.current_scenario = "normal_traffic"

        self._init_default_cluster()

    def _init_default_cluster(self):
        # Setup realistic Disaggregated Inference Cluster:
        # Node-0: Prefill Worker
        # Node-1: Decode Worker 1
        # Node-2: Decode Worker 2
        self.nodes = {
            "node_prefill_0": WorkerNode("node_prefill_0", "Prefill-Worker-0 (A100-80GB)", WorkerRole.PREFILL, self.blocks_per_node, self.block_size),
            "node_decode_0": WorkerNode("node_decode_0", "Decode-Worker-0 (H100-SXM5)", WorkerRole.DECODE, self.blocks_per_node, self.block_size),
            "node_decode_1": WorkerNode("node_decode_1", "Decode-Worker-1 (H100-SXM5)", WorkerRole.DECODE, self.blocks_per_node, self.block_size),
        }

    def log_event(self, category: str, message: str, level: str = "info", details: Optional[Dict[str, Any]] = None):
        self.events.append({
            "timestamp": time.time(),
            "category": category,
            "message": message,
            "level": level,
            "details": details or {}
        })

    def submit_sequence(
        self,
        prompt: str,
        max_tokens: int = 64,
        client_id: Optional[str] = None,
        seq_id: Optional[str] = None
    ) -> Optional[Sequence]:
        seq_id = seq_id or f"seq_{random.randint(1000, 9999)}"
        client_id = client_id or f"client_{random.randint(100, 999)}"
        
        # Estimate prompt token count
        words = prompt.split()
        prompt_token_count = max(4, int(len(words) * 1.3))
        
        seq = Sequence(
            seq_id=seq_id,
            client_id=client_id,
            prompt=prompt,
            prompt_tokens=prompt_token_count,
            generated_tokens=0,
            max_tokens=max_tokens,
            status=SequenceStatus.WAITING,
            logical_blocks=[],
            node_id="node_prefill_0",
            arrival_time=time.time(),
            last_active_time=time.time()
        )
        self.sequences[seq_id] = seq
        self.log_event("SCHEDULER", f"Sequence {seq_id} arrived ({prompt_token_count} prompt tokens) from {client_id}")
        return seq

    def step_prefill(self, seq_id: str) -> bool:
        seq = self.sequences.get(seq_id)
        if not seq or seq.status != SequenceStatus.WAITING:
            return False

        prefill_node = self.nodes.get(seq.node_id)
        if not prefill_node:
            return False

        seq.status = SequenceStatus.PREFILL
        prompt_tokens = seq.prompt_tokens
        needed_blocks = (prompt_tokens + self.block_size - 1) // self.block_size

        # Check for shared system prompt prefix
        prefix_blocks_shared = 0
        allocated_blocks: List[int] = []

        # Split prompt into chunks of block_size
        chunk_words = seq.prompt.split()
        for i in range(needed_blocks):
            chunk_slice = " ".join(chunk_words[i*4 : (i+1)*4]) or f"chunk_{i}"
            prefix_hash = self.radix_cache.compute_prefix_hash(chunk_slice)
            
            self.cache_lookups += 1
            cached_block_id = self.radix_cache.lookup_prefix(prefill_node.node_id, prefix_hash)

            if cached_block_id is not None and cached_block_id in prefill_node.pool.blocks and prefill_node.pool.blocks[cached_block_id].state != BlockState.FREE:
                # Cache hit! Share block
                self.cache_hits += 1
                prefill_node.pool.share_block(cached_block_id, seq.seq_id)
                allocated_blocks.append(cached_block_id)
                prefix_blocks_shared += 1
            else:
                # Cache miss: allocate fresh block
                tokens_in_block = min(self.block_size, prompt_tokens - (i * self.block_size))
                block = prefill_node.pool.allocate_block(
                    seq_id=seq.seq_id,
                    token_count=tokens_in_block,
                    prefix_hash=prefix_hash,
                    preview=chunk_slice[:24]
                )
                if not block:
                    # Out of memory on Prefill Node
                    seq.status = SequenceStatus.PREEMPTED
                    self.log_event("OOM", f"Prefill node OOM when allocating block for {seq_id}", "error")
                    return False
                
                allocated_blocks.append(block.block_id)
                # Register in prefix radix tree if it is a full block
                if tokens_in_block == self.block_size:
                    self.radix_cache.register_block(prefix_hash, prefill_node.node_id, block.block_id, chunk_slice)

        seq.logical_blocks = allocated_blocks
        seq.prefix_shared_blocks = prefix_blocks_shared
        prefill_node.active_sequences[seq_id] = seq
        seq.last_active_time = time.time()
        
        # Prefill completed, transfer KV cache to Decode worker
        self._migrate_to_decode_worker(seq)
        return True

    def _migrate_to_decode_worker(self, seq: Sequence):
        """Simulates Disaggregated KV-Cache Transfer over RDMA/PCIe to Decode worker"""
        prefill_node = self.nodes.get("node_prefill_0")
        
        # Pick decode worker with lower memory pressure
        decode_candidates = [n for n in self.nodes.values() if n.role == WorkerRole.DECODE]
        decode_node = min(decode_candidates, key=lambda n: len(n.pool.blocks) - len(n.pool.free_queue))

        # Check if decode node has enough free blocks
        needed = len(seq.logical_blocks)
        if len(decode_node.pool.free_queue) < needed + 1:
            seq.status = SequenceStatus.PAUSED
            self.log_event("KV_TRANSFER_STALL", f"Decode worker {decode_node.node_id} free queue full. Transfer halted for {seq.seq_id}", "warn")
            return

        # Allocate matching blocks on decode worker
        decode_blocks: List[int] = []
        for i, src_blk_id in enumerate(seq.logical_blocks):
            src_blk = prefill_node.pool.blocks[src_blk_id]
            dst_blk = decode_node.pool.allocate_block(
                seq_id=seq.seq_id,
                token_count=src_blk.token_count,
                prefix_hash=src_blk.prefix_hash,
                preview=src_blk.tokens_preview
            )
            if dst_blk:
                decode_blocks.append(dst_blk.block_id)
            # Release prefill node copy
            prefill_node.pool.release_block(src_blk_id, seq.seq_id)

        if seq.seq_id in prefill_node.active_sequences:
            del prefill_node.active_sequences[seq.seq_id]

        seq.node_id = decode_node.node_id
        seq.logical_blocks = decode_blocks
        seq.status = SequenceStatus.DECODING
        decode_node.active_sequences[seq.seq_id] = seq
        seq.last_active_time = time.time()
        
        self.log_event("KV_MIGRATION", f"Transferred KV cache ({len(decode_blocks)} blocks) for {seq.seq_id} -> {decode_node.name}", "info")

    def step_decode(self, seq_id: str) -> bool:
        seq = self.sequences.get(seq_id)
        if not seq or seq.status != SequenceStatus.DECODING:
            return False

        node = self.nodes.get(seq.node_id)
        if not node:
            return False

        # If sequence reached max tokens, finish
        if seq.generated_tokens >= seq.max_tokens:
            self.finish_sequence(seq_id)
            return False

        # Generate 1 token
        seq.generated_tokens += 1
        seq.last_active_time = time.time()

        if not seq.logical_blocks:
            # Allocate first block
            blk = node.pool.allocate_block(seq_id=seq.seq_id, token_count=1, preview=f"gen_{seq_id[:4]}")
            if blk:
                seq.logical_blocks.append(blk.block_id)
            return True

        last_block_id = seq.logical_blocks[-1]
        last_block = node.pool.blocks.get(last_block_id)

        if last_block and last_block.token_count < self.block_size:
            # Space in current tail block
            node.pool.append_token(last_block_id)
        else:
            # Need new physical block for next token!
            new_blk = node.pool.allocate_block(seq_id=seq.seq_id, token_count=1, preview=f"gen_{seq_id[:4]}_{len(seq.logical_blocks)}")
            if new_blk:
                seq.logical_blocks.append(new_blk.block_id)
            else:
                seq.status = SequenceStatus.PAUSED
                self.log_event("DECODE_STALL", f"Out of blocks on {node.name} during token decode for {seq.seq_id}", "warn")
                return False

        return True

    def finish_sequence(self, seq_id: str):
        seq = self.sequences.get(seq_id)
        if not seq:
            return

        node = self.nodes.get(seq.node_id)
        if node:
            for blk_id in list(seq.logical_blocks):
                node.pool.release_block(blk_id, seq_id)
            if seq_id in node.active_sequences:
                del node.active_sequences[seq_id]

        seq.status = SequenceStatus.FINISHED
        seq.last_active_time = time.time()
        self.total_completed_sequences += 1
        self.log_event("COMPLETED", f"Sequence {seq_id} completed ({seq.prompt_tokens + seq.generated_tokens} total tokens freed)")

    def inject_hostage_leak(self, seq_id: Optional[str] = None, reason: str = "CLIENT_DISCONNECTED_UNGRACEFULLY") -> Optional[str]:
        """Simulates an invisible logical memory leak where sequence drops connection but blocks stay hostage"""
        active_decodes = [s for s in self.sequences.values() if s.status == SequenceStatus.DECODING]
        if not active_decodes:
            return None
        
        target_seq = next((s for s in active_decodes if s.seq_id == seq_id), random.choice(active_decodes))
        target_seq.status = SequenceStatus.ZOMBIE_LEAKED
        target_seq.is_hostage = True
        target_seq.hostage_reason = reason
        
        node = self.nodes.get(target_seq.node_id)
        if node:
            for blk_id in target_seq.logical_blocks:
                if blk_id in node.pool.blocks:
                    node.pool.blocks[blk_id].state = BlockState.HOSTAGE_ZOMBIE

        self.log_event("HOSTAGE_LEAK_INJECTED", f"Sequence {target_seq.seq_id} leaked! {len(target_seq.logical_blocks)} blocks held hostage ({reason})", "error")
        return target_seq.seq_id

    def reclaim_hostage_sequence(self, seq_id: str) -> int:
        """Remediates and frees hostage/zombie blocks for a sequence"""
        seq = self.sequences.get(seq_id)
        if not seq or not seq.is_hostage:
            return 0

        node = self.nodes.get(seq.node_id)
        freed_count = 0
        if node:
            for blk_id in list(seq.logical_blocks):
                node.pool.release_block(blk_id, seq_id)
                freed_count += 1
            if seq_id in node.active_sequences:
                del node.active_sequences[seq_id]

        seq.status = SequenceStatus.FINISHED
        seq.is_hostage = False
        seq.hostage_reason = None
        self.log_event("REMEDIATION", f"Reclaimed {freed_count} hostage blocks from zombie sequence {seq_id}", "info")
        return freed_count

    def reclaim_all_hostages(self) -> int:
        zombies = [s.seq_id for s in self.sequences.values() if s.is_hostage]
        total_freed = sum(self.reclaim_hostage_sequence(zid) for zid in zombies)
        return total_freed

    def defragment_node(self, node_id: str) -> int:
        """Simulates cache pool compaction/defragmentation (consolidating sparse tail blocks)"""
        node = self.nodes.get(node_id)
        if not node:
            return 0
        
        compacted = 0
        tail_blocks = [b for b in node.pool.blocks.values() if b.state == BlockState.ACTIVE and b.slack_tokens > (self.block_size // 2)]
        for b in tail_blocks:
            # Simulate compacting slack space
            compacted += 1
        
        self.log_event("DEFRAGMENTATION", f"Defragmented cache pool on {node.name}, compacted {compacted} sparse blocks", "info")
        return compacted

    def tick(self):
        """Simulation tick: advances prefill and decode sequences"""
        if not self.is_running:
            return

        # 1. Prefill waiting sequences
        waiting = [s.seq_id for s in self.sequences.values() if s.status == SequenceStatus.WAITING]
        for sid in waiting[:3]: # Prefill up to 3 sequences per tick
            self.step_prefill(sid)

        # 2. Decode active sequences
        decoding = [s.seq_id for s in self.sequences.values() if s.status == SequenceStatus.DECODING]
        for sid in decoding:
            self.step_decode(sid)

    def reset(self):
        self._init_default_cluster()
        self.radix_cache = PrefixRadixTree()
        self.sequences.clear()
        self.events.clear()
        self.total_completed_sequences = 0
        self.cache_lookups = 0
        self.cache_hits = 0
        self.log_event("SYSTEM", "KV Cache Engine reset to initial state", "info")
