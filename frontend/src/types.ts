export type BlockState = 'FREE' | 'ACTIVE' | 'PREFIX_SHARED' | 'HOSTAGE_ZOMBIE' | 'PINNED' | 'SLACK_WASTE';

export type SequenceStatus = 'WAITING' | 'PREFILL' | 'DECODING' | 'FINISHED' | 'ZOMBIE_LEAKED' | 'PAUSED' | 'PREEMPTED';

export type WorkerRole = 'PREFILL' | 'DECODE' | 'UNIFIED';

export interface Block {
  block_id: number;
  physical_id: number;
  node_id: string;
  state: BlockState;
  ref_count: number;
  token_count: number;
  capacity: number;
  sequence_ids: string[];
  prefix_hash?: string | null;
  tokens_preview?: string | null;
  allocated_at?: number | null;
  last_accessed_at?: number | null;
  is_tail_block: boolean;
  slack_tokens: number;
}

export interface Sequence {
  seq_id: string;
  client_id: string;
  prompt: string;
  prompt_tokens: number;
  generated_tokens: number;
  max_tokens: number;
  status: SequenceStatus;
  logical_blocks: number[];
  node_id: string;
  arrival_time: number;
  last_active_time: number;
  is_hostage: boolean;
  hostage_reason?: string | null;
  prefix_shared_blocks: number;
}

export interface WorkerNodeState {
  node_id: string;
  name: string;
  role: WorkerRole;
  total_blocks: number;
  block_size: number;
  allocated_blocks_count: number;
  free_blocks_count: number;
  shared_blocks_count: number;
  hostage_blocks_count: number;
  memory_pressure_pct: number;
  internal_fragmentation_pct: number;
  external_fragmentation_pct: number;
  active_sequence_ids: string[];
}

export interface HostageReport {
  sequence_id: string;
  client_id: string;
  node_id: string;
  hostage_block_ids: number[];
  idle_duration_sec: number;
  wasted_memory_kb: number;
  reason: string;
  detected_at: number;
}

export interface DiagnosticReport {
  health_score: number;
  hostage_sequences: HostageReport[];
  total_hostage_blocks: number;
  total_wasted_vram_mb: number;
  severe_fragmentation_nodes: string[];
  prefix_thrashing_warnings: string[];
  recommendations: string[];
}

export interface ClusterMetrics {
  timestamp: number;
  total_vram_mb: number;
  used_vram_mb: number;
  logical_tokens_cached: number;
  physical_tokens_allocated: number;
  allocation_efficiency_pct: number;
  internal_frag_pct: number;
  external_frag_pct: number;
  prefix_cache_hit_rate: number;
  hostage_blocks_count: number;
  estimated_waste_usd_per_hour: number;
  total_active_sequences: number;
  total_completed_sequences: number;
}

export interface EventLog {
  timestamp: number;
  category: string;
  message: string;
  level: 'info' | 'warn' | 'error';
  details?: Record<string, any>;
}

export interface SystemStateSnapshot {
  timestamp: number;
  is_running: boolean;
  scenario: string;
  nodes: Record<string, WorkerNodeState>;
  blocks_by_node: Record<string, Block[]>;
  sequences: Record<string, Sequence>;
  metrics: ClusterMetrics;
  diagnostics: DiagnosticReport;
  recent_events: EventLog[];
}
