import os
import asyncio
import json
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel

from backend.kv_engine import DisaggregatedEngine
from backend.analyzer import LogicalMemoryAnalyzer
from backend.chaos import ScenarioGenerator
from backend.models import SystemStateSnapshot

# Global instances
engine = DisaggregatedEngine(block_size=16, blocks_per_node=128)
analyzer = LogicalMemoryAnalyzer(engine)
scenario_gen = ScenarioGenerator(engine)

simulation_speed = 1.0  # 1.0 = normal (100ms per tick)
is_simulation_active = True

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: str):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(data)
            except Exception:
                self.disconnect(connection)

ws_manager = ConnectionManager()

async def simulation_loop():
    """Background loop that ticks the KV cache engine and streams snapshots over WebSocket"""
    while True:
        try:
            if is_simulation_active and engine.is_running:
                engine.tick()
                scenario_gen.tick()

            # Broadcast state if there are active listeners
            if ws_manager.active_connections:
                snapshot = analyzer.get_full_snapshot()
                # Serialized to JSON
                payload = snapshot.model_dump_json()
                await ws_manager.broadcast(payload)

            sleep_time = max(0.05, 0.15 / max(0.1, simulation_speed))
            await asyncio.sleep(sleep_time)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Simulation Loop Error] {e}")
            await asyncio.sleep(0.5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start simulation task on startup
    task = asyncio.create_task(simulation_loop())
    yield
    task.cancel()

app = FastAPI(
    title="KVCacheScope API",
    description="Logical KV Cache Profiler and Fragmentation Inspector for PagedAttention",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class SubmitSequenceRequest(BaseModel):
    prompt: str
    max_tokens: int = 48
    client_id: Optional[str] = None

class ScenarioRequest(BaseModel):
    scenario: str

class InjectLeakRequest(BaseModel):
    sequence_id: Optional[str] = None
    reason: Optional[str] = "CLIENT_DISCONNECTED_UNGRACEFULLY"

class ReclaimRequest(BaseModel):
    sequence_id: Optional[str] = None
    all: bool = False

class DefragRequest(BaseModel):
    node_id: str

class SimControlRequest(BaseModel):
    running: Optional[bool] = None
    speed: Optional[float] = None
    auto_traffic: Optional[bool] = None

# REST Endpoints
@app.get("/api/state", response_model=SystemStateSnapshot)
def get_state():
    return analyzer.get_full_snapshot()

@app.post("/api/sequence/submit")
def submit_sequence(req: SubmitSequenceRequest):
    seq = engine.submit_sequence(prompt=req.prompt, max_tokens=req.max_tokens, client_id=req.client_id)
    return {"status": "ok", "sequence": seq}

@app.post("/api/scenarios/set")
def set_scenario(req: ScenarioRequest):
    scenario_gen.set_scenario(req.scenario)
    return {"status": "ok", "scenario": req.scenario}

@app.post("/api/chaos/inject_leak")
def inject_leak(req: InjectLeakRequest):
    target_id = engine.inject_hostage_leak(req.sequence_id, req.reason or "UNEXPECTED_CLIENT_ABORT")
    if not target_id:
        raise HTTPException(status_code=400, detail="No active decoding sequence available to leak")
    return {"status": "ok", "leaked_sequence_id": target_id}

@app.post("/api/diagnostics/reclaim")
def reclaim_hostages(req: ReclaimRequest):
    if req.all:
        freed = engine.reclaim_all_hostages()
        return {"status": "ok", "freed_blocks": freed}
    elif req.sequence_id:
        freed = engine.reclaim_hostage_sequence(req.sequence_id)
        return {"status": "ok", "freed_blocks": freed, "sequence_id": req.sequence_id}
    else:
        raise HTTPException(status_code=400, detail="Must provide sequence_id or all=true")

@app.post("/api/diagnostics/defragment")
def defragment_node(req: DefragRequest):
    compacted = engine.defragment_node(req.node_id)
    return {"status": "ok", "compacted_blocks": compacted, "node_id": req.node_id}

@app.post("/api/simulation/control")
def control_simulation(req: SimControlRequest):
    global simulation_speed, is_simulation_active
    if req.running is not None:
        is_simulation_active = req.running
        engine.is_running = req.running
    if req.speed is not None:
        simulation_speed = max(0.1, min(5.0, req.speed))
    if req.auto_traffic is not None:
        scenario_gen.auto_traffic = req.auto_traffic
    return {
        "status": "ok",
        "running": is_simulation_active,
        "speed": simulation_speed,
        "auto_traffic": scenario_gen.auto_traffic
    }

@app.post("/api/simulation/reset")
def reset_simulation():
    engine.reset()
    return {"status": "ok", "message": "Simulation reset successfully"}

@app.get("/api/metrics/prometheus")
def get_prometheus_metrics():
    metrics = analyzer.calculate_cluster_metrics()
    lines = [
        "# HELP kv_cache_vram_total_mb Total VRAM in MB managed by PagedAttention",
        "# TYPE kv_cache_vram_total_mb gauge",
        f"kv_cache_vram_total_mb {metrics.total_vram_mb}",
        "# HELP kv_cache_vram_used_mb Used VRAM in MB",
        "# TYPE kv_cache_vram_used_mb gauge",
        f"kv_cache_vram_used_mb {metrics.used_vram_mb}",
        "# HELP kv_cache_internal_fragmentation_percent Slack space percentage within allocated blocks",
        "# TYPE kv_cache_internal_fragmentation_percent gauge",
        f"kv_cache_internal_fragmentation_percent {metrics.internal_frag_pct}",
        "# HELP kv_cache_external_fragmentation_percent Free queue fragmentation index",
        "# TYPE kv_cache_external_fragmentation_percent gauge",
        f"kv_cache_external_fragmentation_percent {metrics.external_frag_pct}",
        "# HELP kv_cache_hostage_blocks_count Number of blocks held hostage by zombie sequences",
        "# TYPE kv_cache_hostage_blocks_count gauge",
        f"kv_cache_hostage_blocks_count {metrics.hostage_blocks_count}",
        "# HELP kv_cache_prefix_hit_rate Prefix cache reuse percentage",
        "# TYPE kv_cache_prefix_hit_rate gauge",
        f"kv_cache_prefix_hit_rate {metrics.prefix_cache_hit_rate}",
    ]
    return PlainTextResponse("\n".join(lines), media_type="text/plain")

@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial snapshot immediately
        snapshot = analyzer.get_full_snapshot()
        await websocket.send_text(snapshot.model_dump_json())
        
        while True:
            # Keep receiving client commands or heartbeat
            msg = await websocket.receive_text()
            try:
                data = json.loads(msg)
                action = data.get("action")
                if action == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)

# Mount frontend build static files if present
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept /api or /ws
        if full_path.startswith("api") or full_path.startswith("ws"):
            raise HTTPException(status_code=404)
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
