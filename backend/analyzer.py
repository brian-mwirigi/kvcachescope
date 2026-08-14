import time
from typing import List, Dict, Tuple
from backend.models import (
    BlockState, SequenceStatus, ClusterMetrics,
    DiagnosticReport, HostageReport, SystemStateSnapshot
)
from backend.kv_engine import DisaggregatedEngine

# 1 block (16 tokens) in Llama-3-70B (80 layers, 8 KV heads, 128 head dim, FP16)
# = 16 tokens * 80 layers * 8 heads * 128 dim * 2 bytes * 2 (K+V) = 5.24 MB per block
# Or for standard 7B-8B: ~320 KB per block
BYTES_PER_BLOCK_7B = 320 * 1024  # 320 KB
USD_PER_GPU_HOUR = 3.50          # H100 cloud rate

class LogicalMemoryAnalyzer:
    def __init__(self, engine: DisaggregatedEngine):
        self.engine = engine

    def analyze_diagnostics(self) -> DiagnosticReport:
        now = time.time()
        hostage_reports: List[HostageReport] = []
        total_hostage_blocks = 0
        total_wasted_kb = 0.0
        severe_frag_nodes: List[str] = []
        recommendations: List[str] = []
        prefix_warnings: List[str] = []

        # 1. Scan for explicit zombie leaks and long-idle hostage sequences
        for seq_id, seq in self.engine.sequences.items():
            is_zombie = (seq.status == SequenceStatus.ZOMBIE_LEAKED or seq.is_hostage)
            idle_duration = now - seq.last_active_time
            
            # If sequence is decoding or prefill but hasn't had activity for > 20s
            is_stalled = (seq.status in [SequenceStatus.DECODING, SequenceStatus.PREFILL] and idle_duration > 20.0)

            if is_zombie or is_stalled:
                block_count = len(seq.logical_blocks)
                wasted_kb = (block_count * BYTES_PER_BLOCK_7B) / 1024.0
                reason = seq.hostage_reason or ("STALLED_CLIENT_INACTIVITY" if is_stalled else "ORPHANED_LOGICAL_TABLE")
                
                report = HostageReport(
                    sequence_id=seq.seq_id,
                    client_id=seq.client_id,
                    node_id=seq.node_id,
                    hostage_block_ids=list(seq.logical_blocks),
                    idle_duration_sec=round(idle_duration, 1),
                    wasted_memory_kb=round(wasted_kb, 1),
                    reason=reason,
                    detected_at=now
                )
                hostage_reports.append(report)
                total_hostage_blocks += block_count
                total_wasted_kb += wasted_kb

        # 2. Check for node fragmentation severity
        for node_id, node in self.engine.nodes.items():
            state = node.get_state()
            if state.internal_fragmentation_pct > 35.0 or state.external_fragmentation_pct > 40.0:
                severe_frag_nodes.append(f"{node.name} (Slack: {state.internal_fragmentation_pct}%, Ext: {state.external_fragmentation_pct}%)")

        # 3. Check prefix cache efficiency
        hit_rate = (self.engine.cache_hits / self.engine.cache_lookups * 100) if self.engine.cache_lookups > 0 else 0.0
        if self.engine.cache_lookups > 20 and hit_rate < 15.0:
            prefix_warnings.append(f"Low prefix cache reuse ({round(hit_rate, 1)}%). High prompt variance causing block allocation churn.")

        # 4. Generate recommendations & calculate health score
        health_score = 100
        if hostage_reports:
            health_score -= min(50, len(hostage_reports) * 15)
            recommendations.append(f"Reclaim {len(hostage_reports)} hostage sequences to recover {round(total_wasted_kb / 1024, 2)} MB of locked VRAM.")
        
        if severe_frag_nodes:
            health_score -= 20
            recommendations.append(f"Trigger cache pool defragmentation on {len(severe_frag_nodes)} worker node(s) with high slack.")

        if prefix_warnings:
            health_score -= 10
            recommendations.append("Adjust Radix tree cache TTL or enable chunked prompt prefix hashing.")

        health_score = max(0, health_score)

        return DiagnosticReport(
            health_score=health_score,
            hostage_sequences=hostage_reports,
            total_hostage_blocks=total_hostage_blocks,
            total_wasted_vram_mb=round(total_wasted_kb / 1024.0, 2),
            severe_fragmentation_nodes=severe_frag_nodes,
            prefix_thrashing_warnings=prefix_warnings,
            recommendations=recommendations
        )

    def calculate_cluster_metrics(self) -> ClusterMetrics:
        total_blocks = sum(n.total_blocks for n in self.engine.nodes.values())
        total_allocated_blocks = 0
        total_slack_tokens = 0
        total_active_tokens = 0
        hostage_blocks = 0

        for node in self.engine.nodes.values():
            for block in node.pool.blocks.values():
                if block.state != BlockState.FREE:
                    total_allocated_blocks += 1
                    total_active_tokens += block.token_count
                    total_slack_tokens += block.slack_tokens
                    if block.state == BlockState.HOSTAGE_ZOMBIE:
                        hostage_blocks += 1

        total_vram_mb = round((total_blocks * BYTES_PER_BLOCK_7B) / (1024 * 1024), 2)
        used_vram_mb = round((total_allocated_blocks * BYTES_PER_BLOCK_7B) / (1024 * 1024), 2)
        
        total_capacity_allocated = total_allocated_blocks * self.engine.block_size
        internal_frag_pct = round((total_slack_tokens / total_capacity_allocated * 100), 1) if total_capacity_allocated > 0 else 0.0
        
        # Avg external fragmentation across nodes
        ext_frags = [n.pool.get_fragmentation_stats()[1] for n in self.engine.nodes.values()]
        avg_external_frag = round(sum(ext_frags) / max(1, len(ext_frags)), 1)

        # Allocation efficiency: active tokens / allocated block capacity
        alloc_efficiency = round((total_active_tokens / total_capacity_allocated * 100), 1) if total_capacity_allocated > 0 else 100.0

        hit_rate = round((self.engine.cache_hits / self.engine.cache_lookups * 100), 1) if self.engine.cache_lookups > 0 else 0.0

        # Estimated cloud cost waste ($/hr) = (Wasted VRAM % * cluster cost)
        wasted_blocks = hostage_blocks + (total_slack_tokens / self.engine.block_size)
        waste_ratio = wasted_blocks / max(1, total_blocks)
        total_cluster_hourly_cost = USD_PER_GPU_HOUR * len(self.engine.nodes)
        estimated_waste_usd = round(waste_ratio * total_cluster_hourly_cost, 3)

        active_seq_count = len([s for s in self.engine.sequences.values() if s.status in [SequenceStatus.WAITING, SequenceStatus.PREFILL, SequenceStatus.DECODING]])

        return ClusterMetrics(
            timestamp=time.time(),
            total_vram_mb=total_vram_mb,
            used_vram_mb=used_vram_mb,
            logical_tokens_cached=total_active_tokens,
            physical_tokens_allocated=total_capacity_allocated,
            allocation_efficiency_pct=alloc_efficiency,
            internal_frag_pct=internal_frag_pct,
            external_frag_pct=avg_external_frag,
            prefix_cache_hit_rate=hit_rate,
            hostage_blocks_count=hostage_blocks,
            estimated_waste_usd_per_hour=estimated_waste_usd,
            total_active_sequences=active_seq_count,
            total_completed_sequences=self.engine.total_completed_sequences
        )

    def get_full_snapshot(self) -> SystemStateSnapshot:
        node_states = {nid: node.get_state() for nid, node in self.engine.nodes.items()}
        blocks_by_node = {nid: list(node.pool.blocks.values()) for nid, node in self.engine.nodes.items()}
        
        # Only return active/recent sequences to keep JSON payload snappy
        recent_sequences = {
            sid: seq for sid, seq in self.engine.sequences.items()
            if seq.status != SequenceStatus.FINISHED or (time.time() - seq.last_active_time < 10)
        }

        return SystemStateSnapshot(
            timestamp=time.time(),
            is_running=self.engine.is_running,
            scenario=self.engine.current_scenario,
            nodes=node_states,
            blocks_by_node=blocks_by_node,
            sequences=recent_sequences,
            metrics=self.calculate_cluster_metrics(),
            diagnostics=self.analyze_diagnostics(),
            recent_events=list(self.engine.events)
        )
