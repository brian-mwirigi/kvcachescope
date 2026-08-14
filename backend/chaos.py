import random
import time
from typing import Dict, Any, Optional
from backend.kv_engine import DisaggregatedEngine

# Sample realistic prompts
SYSTEM_PROMPT_DOCS = "You are an enterprise AI assistant trained on proprietary codebases. Please adhere to security guidelines and output valid markdown with citations."
SYSTEM_PROMPT_CODE = "You are an expert Python and Rust software engineer. Write clean, memory-safe code with comprehensive unit tests and error handling."

USER_PROMPTS_CHAT = [
    "Analyze the memory consumption profile of our vLLM worker nodes under 8k context length.",
    "Explain how PagedAttention block tables map virtual token indices to physical GPU memory.",
    "Draft an RFC for disaggregated prefill and decode KV cache transfer over RDMA RoCEv2.",
    "Identify potential causes of logical KV cache fragmentation in our inference gateway.",
    "Compare prefix caching radix trees with hash-based exact block match lookup tables.",
    "Write a high-performance C++ CUDA kernel for block-sparse attention gathering.",
]

class ScenarioGenerator:
    def __init__(self, engine: DisaggregatedEngine):
        self.engine = engine
        self.scenario_name = "normal_traffic"
        self.auto_traffic = True
        self.last_spawn_time = time.time()
        self.spawn_interval = 1.0  # seconds

    def set_scenario(self, scenario_name: str):
        self.scenario_name = scenario_name
        self.engine.current_scenario = scenario_name
        self.engine.log_event("SCENARIO", f"Switched active scenario to: {scenario_name}", "info")

        if scenario_name == "prefix_caching_demo":
            self._setup_prefix_caching_demo()
        elif scenario_name == "hostage_leak_demo":
            self._setup_hostage_leak_demo()
        elif scenario_name == "disaggregated_stranding":
            self._setup_disaggregated_stranding()
        elif scenario_name == "slack_waste_saturation":
            self._setup_slack_waste_saturation()

    def _setup_prefix_caching_demo(self):
        """Spawns multiple sequences sharing the exact same long system prompt"""
        for i in range(5):
            prompt = f"{SYSTEM_PROMPT_DOCS} User query {i}: {random.choice(USER_PROMPTS_CHAT)}"
            self.engine.submit_sequence(prompt=prompt, max_tokens=32, client_id=f"rag_client_{i}")

    def _setup_hostage_leak_demo(self):
        """Spawns sequences and immediately injects zombie/hostage leaks simulating dropped connections"""
        for i in range(4):
            prompt = f"{SYSTEM_PROMPT_CODE} Task {i}: Generate long context reasoning trace."
            seq = self.engine.submit_sequence(prompt=prompt, max_tokens=64, client_id=f"leaking_agent_{i}")
        
        # We will let them prefill and decode, then the scenario tick will leak them
        self.engine.log_event("CHAOS", "Prepared 4 agent sessions primed for ungraceful network disconnection", "warn")

    def _setup_disaggregated_stranding(self):
        """Floods the cluster with heavy prompt bursts to induce decode worker fragmentation"""
        for i in range(12):
            prompt = f"Heavy batch request {i}: " + ("context data chunk " * 20)
            self.engine.submit_sequence(prompt=prompt, max_tokens=48, client_id=f"batch_job_{i}")

    def _setup_slack_waste_saturation(self):
        """Spawns many short sequences with max_tokens=1 to maximize tail-block internal fragmentation"""
        for i in range(15):
            prompt = f"Short command #{i}"
            self.engine.submit_sequence(prompt=prompt, max_tokens=2, client_id=f"cli_user_{i}")

    def tick(self):
        """Called regularly by background worker to generate background requests or trigger chaos"""
        if not self.auto_traffic:
            return

        now = time.time()
        if now - self.last_spawn_time >= self.spawn_interval:
            self.last_spawn_time = now
            
            active_count = len([s for s in self.engine.sequences.values() if s.status not in ["FINISHED", "ZOMBIE_LEAKED"]])
            
            # If scenario is hostage demo and we have active decodes, leak one randomly!
            if self.scenario_name == "hostage_leak_demo":
                decoding_seqs = [s for s in self.engine.sequences.values() if s.status.value == "DECODING" and not s.is_hostage]
                if decoding_seqs and random.random() < 0.4:
                    target = random.choice(decoding_seqs)
                    self.engine.inject_hostage_leak(target.seq_id, reason="CLIENT_WS_CONNECTION_RESET")

            # Normal traffic regulation (keep 4-10 active requests)
            if active_count < 8:
                sys_prompt = SYSTEM_PROMPT_DOCS if random.random() < 0.6 else SYSTEM_PROMPT_CODE
                query = random.choice(USER_PROMPTS_CHAT)
                full_prompt = f"{sys_prompt} Question: {query}"
                max_tokens = random.randint(16, 64)
                self.engine.submit_sequence(prompt=full_prompt, max_tokens=max_tokens)
