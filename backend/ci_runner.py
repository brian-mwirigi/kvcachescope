import os
import sys
import time
import json
import argparse
from typing import Dict, Any, Optional

# Ensure project root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.kv_engine import DisaggregatedEngine
from backend.analyzer import LogicalMemoryAnalyzer
from backend.chaos import ScenarioGenerator

def run_ci_suite(
    duration_sec: int = 15,
    max_zombie_tolerance: int = 0,
    max_frag_tolerance: float = 50.0,
    scenario: str = "normal_traffic",
    report_json_path: Optional[str] = None
) -> int:
    print("\n" + "="*70)
    print("  KVCacheScope CI/CD Memory Leak & Fragmentation Test Suite")
    print("="*70)
    print(f"  Duration:              {duration_sec} seconds")
    print(f"  Max Zombie Tolerance:  {max_zombie_tolerance} blocks")
    print(f"  Max Frag Tolerance:    {max_frag_tolerance}%")
    print(f"  Scenario:              {scenario}")
    print("="*70 + "\n")

    engine = DisaggregatedEngine(block_size=16, blocks_per_node=128)
    analyzer = LogicalMemoryAnalyzer(engine)
    scenario_gen = ScenarioGenerator(engine)
    scenario_gen.set_scenario(scenario)

    start_time = time.time()
    tick_count = 0
    max_hostage_detected = 0
    max_internal_frag = 0.0
    max_external_frag = 0.0
    total_processed = 0

    print("[*] Running continuous batching stress test...")
    while time.time() - start_time < duration_sec:
        engine.tick()
        scenario_gen.tick()
        tick_count += 1

        # Sample metrics
        metrics = analyzer.calculate_cluster_metrics()
        diagnostics = analyzer.analyze_diagnostics()

        max_hostage_detected = max(max_hostage_detected, metrics.hostage_blocks_count)
        max_internal_frag = max(max_internal_frag, metrics.internal_frag_pct)
        max_external_frag = max(max_external_frag, metrics.external_frag_pct)
        total_processed = metrics.total_completed_sequences

        time.sleep(0.05)

    final_metrics = analyzer.calculate_cluster_metrics()
    final_diag = analyzer.analyze_diagnostics()
    
    elapsed = round(time.time() - start_time, 2)

    # Evaluate Assertions
    zombie_pass = (max_hostage_detected <= max_zombie_tolerance)
    frag_pass = (max_internal_frag <= max_frag_tolerance)
    overall_pass = zombie_pass and frag_pass

    print("\n" + "-"*70)
    print(f"  CI TEST RESULTS (Elapsed: {elapsed}s | Total Ticks: {tick_count})")
    print("-"*70)
    print(f"  Total Sequences Completed:      {total_processed}")
    print(f"  Max Hostage Blocks Detected:    {max_hostage_detected} (Allowed: <= {max_zombie_tolerance}) -> {'[PASS]' if zombie_pass else '[FAIL]'}")
    print(f"  Peak Internal Slack Waste:      {max_internal_frag}% (Allowed: <= {max_frag_tolerance}%) -> {'[PASS]' if frag_pass else '[FAIL]'}")
    print(f"  Peak External Fragmentation:    {max_external_frag}%")
    print(f"  Prefix Cache Reuse Rate:        {final_metrics.prefix_cache_hit_rate}%")
    print(f"  Final Memory Pool Health Score: {final_diag.health_score}/100")
    print("-"*70)

    # Build report data
    report_data = {
        "status": "PASS" if overall_pass else "FAIL",
        "timestamp": time.time(),
        "elapsed_sec": elapsed,
        "total_ticks": tick_count,
        "completed_sequences": total_processed,
        "max_hostage_blocks": max_hostage_detected,
        "max_zombie_tolerance": max_zombie_tolerance,
        "zombie_assertion_passed": zombie_pass,
        "peak_internal_frag_pct": max_internal_frag,
        "peak_external_frag_pct": max_external_frag,
        "max_frag_tolerance_pct": max_frag_tolerance,
        "frag_assertion_passed": frag_pass,
        "health_score": final_diag.health_score,
        "hostage_leaks_summary": [
            {
                "sequence_id": h.sequence_id,
                "hostage_blocks": len(h.hostage_block_ids),
                "reason": h.reason,
                "wasted_kb": h.wasted_memory_kb
            }
            for h in final_diag.hostage_sequences
        ]
    }

    if report_json_path:
        with open(report_json_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2)
        print(f"[+] Machine-readable CI report saved to: {report_json_path}")

    if overall_pass:
        print("\n>>> ALL KV CACHE REGRESSION ASSERTIONS PASSED (Exit Code 0) <<<\n")
        return 0
    else:
        print("\n>>> KV CACHE ASSERTIONS FAILED: Memory leak or fragmentation exceeded threshold! (Exit Code 1) <<<\n")
        return 1

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KVCacheScope Headless CI Regression Runner")
    parser.add_argument("--duration-sec", type=int, default=10, help="Duration of CI stress test in seconds")
    parser.add_argument("--max-zombie-tolerance", type=int, default=0, help="Maximum allowed hostage blocks before failure")
    parser.add_argument("--max-frag-tolerance", type=float, default=50.0, help="Maximum allowable fragmentation percentage")
    parser.add_argument("--scenario", type=str, default="normal_traffic", help="Simulation scenario to run")
    parser.add_argument("--report-json", type=str, default="ci_report.json", help="Path to write JSON test report")
    args = parser.parse_args()

    sys.exit(run_ci_suite(
        duration_sec=args.duration_sec,
        max_zombie_tolerance=args.max_zombie_tolerance,
        max_frag_tolerance=args.max_frag_tolerance,
        scenario=args.scenario,
        report_json_path=args.report_json
    ))
