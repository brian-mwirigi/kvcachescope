import os
import sys
import argparse
import webbrowser
import threading
import time
import uvicorn

from backend.ci_runner import run_ci_suite
from backend.stress_matrix import StressMatrixRunner

def open_browser(port=8000):
    time.sleep(1.2)
    url = f"http://localhost:{port}"
    print(f"\n[KVCacheScope] Launching dashboard visualizer at {url}...")
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Could not automatically open browser: {e}")

def main():
    parser = argparse.ArgumentParser(description="KVCacheScope: Logical KV Cache Profiler & Inspector")
    parser.add_argument("--ci-mode", action="store_true", help="Run in headless CI/CD mode and exit with test status")
    parser.add_argument("--duration-sec", type=int, default=15, help="Duration for CI/CD test run in seconds")
    parser.add_argument("--max-zombie-tolerance", type=int, default=0, help="Max hostage/zombie blocks allowed in CI mode")
    parser.add_argument("--max-frag-tolerance", type=float, default=50.0, help="Max internal fragmentation %% allowed in CI mode")
    parser.add_argument("--scenario", type=str, default="normal_traffic", help="Initial workload scenario")
    parser.add_argument("--report-json", type=str, default="ci_report.json", help="Path to write CI test report JSON")
    parser.add_argument("--stress-suite", action="store_true", help="Run full 5-vector advanced validation & stress testing matrix")
    parser.add_argument("--stress-vector", type=str, default=None, choices=[
        "abort_divergence", "deadlock_99", "prefix_cycle", "speculative_thrash", "hw_abstraction"
    ], help="Run a specific stress testing vector")
    parser.add_argument("--export-perfetto", type=str, default="perfetto_stress_matrix_trace.json", help="Perfetto trace JSON export")
    parser.add_argument("--port", type=int, default=8000, help="Port to serve web dashboard")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host address to bind")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically open browser on startup")

    args = parser.parse_args()

    if args.stress_suite or args.stress_vector:
        runner = StressMatrixRunner()
        if args.stress_suite:
            matrix_results = runner.run_full_matrix()
            runner.perfetto.save_trace(args.export_perfetto)
            print(f"\n[+] Full 5-vector stress testing results: {matrix_results['overall_status']}")
            print(f"[+] Perfetto trace saved to: {args.export_perfetto}")
            sys.exit(0 if matrix_results["overall_status"] == "PASS" else 1)
        elif args.stress_vector:
            vec_map = {
                "abort_divergence": runner.run_vector_1_abort_divergence,
                "deadlock_99": runner.run_vector_2_deadlock_99,
                "prefix_cycle": runner.run_vector_3_prefix_reference_cycle,
                "speculative_thrash": runner.run_vector_4_speculative_thrashing,
                "hw_abstraction": runner.run_vector_5_hardware_abstraction
            }
            res = vec_map[args.stress_vector]()
            print(f"Result [{args.stress_vector}]: {res['status']}")
            sys.exit(0 if res["status"] == "PASS" else 1)

    if args.ci_mode:
        exit_code = run_ci_suite(
            duration_sec=args.duration_sec,
            max_zombie_tolerance=args.max_zombie_tolerance,
            max_frag_tolerance=args.max_frag_tolerance,
            scenario=args.scenario,
            report_json_path=args.report_json
        )
        sys.exit(exit_code)

    print("""
===================================================================
    _  ____     ______           _          ____                      
   | |/ /\ \   / / ___|__ _  ___| |__   ___/ ___|  ___ ___  _ __   ___ 
   | ' /  \ \ / / |   / _` |/ __| '_ \ / _ \___ \ / __/ _ \| '_ \ / _ \\
   | . \   \ V /| |__| (_| | (__| | | |  __/___) | (_| (_) | |_) |  __/
   |_|\_\   \_/  \____\__,_|\___|_| |_|\___|____/ \___\___/| .__/ \___|
                                                           |_|         
   Logical KV Cache Profiler & Fragmentation Inspector for PagedAttention
===================================================================
""")
    
    if not args.no_browser:
        threading.Thread(target=open_browser, args=(args.port,), daemon=True).start()
    
    print(f"[*] Starting KVCacheScope Server on http://localhost:{args.port}")
    print(f"[*] Serving REST API, WebSockets (/ws/stream), and built Frontend SPA...")
    print(f"[*] Press CTRL+C to terminate.\n")
    
    uvicorn.run("backend.server:app", host=args.host, port=args.port, log_level="info")

if __name__ == "__main__":
    main()
