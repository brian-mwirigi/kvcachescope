from enum import Enum
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
import time

class BlockState(str, Enum):
    FREE = "FREE"
    ACTIVE = "ACTIVE"
    PREFIX_SHARED = "PREFIX_SHARED"
    HOSTAGE_ZOMBIE = "HOSTAGE_ZOMBIE"
    PINNED = "PINNED"
    SLACK_WASTE = "SLACK_WASTE"

class SequenceStatus(str, Enum):
    WAITING = "WAITING"
    PREFILL = "PREFILL"
    DECODING = "DECODING"
    FINISHED = "FINISHED"
    ZOMBIE_LEAKED = "ZOMBIE_LEAKED"
    PAUSED = "PAUSED"
    PREEMPTED = "PREEMPTED"

class WorkerRole(str, Enum):
    PREFILL = "PREFILL"
    DECODE = "DECODE"
    UNIFIED = "UNIFIED"

class Block(BaseModel):
    block_id: int
    physical_id: int
    node_id: str
    state: BlockState = BlockState.FREE
    ref_count: int = 0
    token_count: int = 0
    capacity: int = 16
    sequence_ids: List[str] = Field(default_factory=list)
    prefix_hash: Optional[str] = None
    tokens_preview: Optional[str] = None
    allocated_at: Optional[float] = None
    last_accessed_at: Optional[float] = None
    is_tail_block: bool = False
    slack_tokens: int = 0

    @property
    def slack_percentage(self) -> float:
        if self.token_count == 0 or self.state == BlockState.FREE:
            return 0.0
        return round(((self.capacity - self.token_count) / self.capacity) * 100, 1)

class Sequence(BaseModel):
    seq_id: str
    client_id: str
    prompt: str
    prompt_tokens: int
    generated_tokens: int = 0
    max_tokens: int
    status: SequenceStatus = SequenceStatus.WAITING
    logical_blocks: List[int] = Field(default_factory=list)
    node_id: str
    arrival_time: float = Field(default_factory=time.time)
    last_active_time: float = Field(default_factory=time.time)
    is_hostage: bool = False
    hostage_reason: Optional[str] = None
    prefix_shared_blocks: int = 0

class WorkerNodeState(BaseModel):
    node_id: str
    name: str
    role: WorkerRole
    total_blocks: int
    block_size: int = 16
    allocated_blocks_count: int = 0
    free_blocks_count: int = 0
    shared_blocks_count: int = 0
    hostage_blocks_count: int = 0
    memory_pressure_pct: float = 0.0
    internal_fragmentation_pct: float = 0.0
    external_fragmentation_pct: float = 0.0
    active_sequence_ids: List[str] = Field(default_factory=list)

class HostageReport(BaseModel):
    sequence_id: str
    client_id: str
    node_id: str
    hostage_block_ids: List[int]
    idle_duration_sec: float
    wasted_memory_kb: float
    reason: str
    detected_at: float = Field(default_factory=time.time)

class DiagnosticReport(BaseModel):
    health_score: int = 100
    hostage_sequences: List[HostageReport] = Field(default_factory=list)
    total_hostage_blocks: int = 0
    total_wasted_vram_mb: float = 0.0
    severe_fragmentation_nodes: List[str] = Field(default_factory=list)
    prefix_thrashing_warnings: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)

class ClusterMetrics(BaseModel):
    timestamp: float = Field(default_factory=time.time)
    total_vram_mb: float
    used_vram_mb: float
    logical_tokens_cached: int
    physical_tokens_allocated: int
    allocation_efficiency_pct: float
    internal_frag_pct: float
    external_frag_pct: float
    prefix_cache_hit_rate: float
    hostage_blocks_count: int
    estimated_waste_usd_per_hour: float
    total_active_sequences: int
    total_completed_sequences: int

class SystemStateSnapshot(BaseModel):
    timestamp: float
    is_running: bool
    scenario: str
    nodes: Dict[str, WorkerNodeState]
    blocks_by_node: Dict[str, List[Block]]
    sequences: Dict[str, Sequence]
    metrics: ClusterMetrics
    diagnostics: DiagnosticReport
    recent_events: List[Dict[str, Any]] = Field(default_factory=list)
