"""
KVCacheScope Advanced Stress Test Suite CLI
===========================================
Executes the comprehensive 5-vector stress testing matrix:
    python backend/stress_test_suite.py --vector all
    python backend/stress_test_suite.py --vector abort_divergence
    python backend/stress_test_suite.py --vector deadlock_99
    python backend/stress_test_suite.py --vector prefix_cycle
    python backend/stress_test_suite.py --vector speculative_thrash
    python backend/stress_test_suite.py --vector hw_abstraction
"""

import os
import sys
import json
import argparse

# Ensure project root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.stress_matrix import StressMatrixRunner

def main():
    parser = argparse.ArgumentParser(description="KVCacheScope Advanced Stress Testing Suite")
    parser.add_argument("--vector", type=str, default="all", choices=[
        "all", "abort_divergence", "deadlock_99", "prefix_cycle", "speculative_thrash", "hw_abstraction"
    ], help="Stress vector to execute")
    parser.add_argument("--report-json", type=str, default="stress_matrix_report.json", help="Path to write JSON test report")
    parser.add_argument("--export-perfetto", type=str, default="perfetto_stress_matrix_trace.json", help="Perfetto trace JSON export")
    args = parser.parse_args()

    print("\n" + "="*78)
    print("  KVCacheScope Advanced Validation & Stress Testing Protocol")
    print("="*78)
    print(f"  Target Vector:         {args.vector.upper()}")
    print(f"  JSON Report Path:      {args.report_json}")
    print(f"  Perfetto Trace File:   {args.export_perfetto}")
    print("="*78 + "\n")

    runner = StressMatrixRunner()

    if args.vector == "all":
        matrix_results = runner.run_full_matrix()
        runner.perfetto.save_trace(args.export_perfetto)

        print("-" * 78)
        print("  VECTOR RESULTS SUMMARY")
        print("-" * 78)
        for vec_key, vec_data in matrix_results["vectors"].items():
            status = vec_data["status"]
            status_str = f"[PASS]" if status == "PASS" else f"[FAIL]"
            print(f"  * {vec_key.ljust(36)} -> {status_str}")
            for k, v in vec_data.get("details", {}).items():
                print(f"      - {k}: {v}")
        print("-" * 78)

        with open(args.report_json, "w", encoding="utf-8") as f:
            json.dump(matrix_results, f, indent=2)

        print(f"\n[+] Full stress report saved to: {args.report_json}")
        print(f"[+] Perfetto ground-truth trace saved to: {args.export_perfetto}")
        print(f"[!] To inspect timeline: open https://ui.perfetto.dev/ and load {args.export_perfetto}\n")

        if matrix_results["overall_status"] == "PASS":
            print(">>> ALL 5 ADVANCED STRESS VECTORS PASSED (Exit Code 0) <<<\n")
            sys.exit(0)
        else:
            print(">>> STRESS TESTING SUITE FAILED (Exit Code 1) <<<\n")
            sys.exit(1)
    else:
        # Single vector run
        vec_map = {
            "abort_divergence": runner.run_vector_1_abort_divergence,
            "deadlock_99": runner.run_vector_2_deadlock_99,
            "prefix_cycle": runner.run_vector_3_prefix_reference_cycle,
            "speculative_thrash": runner.run_vector_4_speculative_thrashing,
            "hw_abstraction": runner.run_vector_5_hardware_abstraction
        }
        res = vec_map[args.vector]()
        runner.perfetto.save_trace(args.export_perfetto)

        print(f"Result: [{res['status']}]")
        print(json.dumps(res, indent=2))
        sys.exit(0 if res["status"] == "PASS" else 1)

if __name__ == "__main__":
    main()
