from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import httpx
import dns.resolver
from datetime import datetime
import hashlib

router = APIRouter()

# In-memory storage for monitoring targets and history
dns_monitors = {}  # {id: {domain, last_cname, history: []}}
api_monitors = {}  # {id: {url, method, headers, last_hash, last_response, history: []}}
monitoring_task = None


class DNSMonitor(BaseModel):
    domain: str
    check_interval: int = 300  # seconds (default: 5 minutes)


class APIMonitor(BaseModel):
    url: str
    method: str = "GET"
    headers: Optional[Dict[str, str]] = None
    body: Optional[str] = None
    check_interval: int = 300  # seconds (default: 5 minutes)


class MonitorResponse(BaseModel):
    id: str
    type: str
    target: str
    status: str
    last_check: Optional[str] = None
    last_value: Optional[str] = None
    changes_detected: int = 0


async def check_dns_cname(domain: str) -> Optional[str]:
    """Check DNS CNAME record for a domain"""
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 5
        resolver.lifetime = 5

        answers = resolver.resolve(domain, 'CNAME')
        cnames = [str(rdata.target).rstrip('.') for rdata in answers]
        return ', '.join(cnames) if cnames else None
    except dns.resolver.NoAnswer:
        return "No CNAME record"
    except dns.resolver.NXDOMAIN:
        return "Domain not found"
    except Exception as e:
        return f"Error: {str(e)}"


async def check_api_response(url: str, method: str = "GET", headers: Optional[Dict] = None, body: Optional[str] = None) -> Dict[str, Any]:
    """Check API endpoint and return response details"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if method.upper() == "GET":
                response = await client.get(url, headers=headers or {})
            elif method.upper() == "POST":
                response = await client.post(url, headers=headers or {}, content=body or "")
            elif method.upper() == "PUT":
                response = await client.put(url, headers=headers or {}, content=body or "")
            else:
                response = await client.get(url, headers=headers or {})

            response_text = response.text
            response_hash = hashlib.md5(response_text.encode()).hexdigest()

            return {
                "status_code": response.status_code,
                "content_hash": response_hash,
                "content": response_text[:1000],  # Store first 1000 chars
                "headers": dict(response.headers),
                "success": True
            }
    except Exception as e:
        return {
            "error": str(e),
            "success": False
        }


async def monitoring_loop():
    """Background task to periodically check all monitors"""
    while True:
        try:
            # Check DNS monitors
            for monitor_id, monitor in dns_monitors.items():
                current_time = datetime.now().isoformat()
                cname = await check_dns_cname(monitor["domain"])

                # Check if CNAME changed
                if monitor["last_cname"] is not None and monitor["last_cname"] != cname:
                    monitor["history"].append({
                        "timestamp": current_time,
                        "old_value": monitor["last_cname"],
                        "new_value": cname,
                        "change_type": "CNAME changed"
                    })
                    monitor["changes_detected"] = monitor.get("changes_detected", 0) + 1

                monitor["last_cname"] = cname
                monitor["last_check"] = current_time
                monitor["status"] = "active"

            # Check API monitors
            for monitor_id, monitor in api_monitors.items():
                current_time = datetime.now().isoformat()
                result = await check_api_response(
                    monitor["url"],
                    monitor.get("method", "GET"),
                    monitor.get("headers"),
                    monitor.get("body")
                )

                if result["success"]:
                    current_hash = result["content_hash"]

                    # Check if response changed
                    if monitor["last_hash"] is not None and monitor["last_hash"] != current_hash:
                        monitor["history"].append({
                            "timestamp": current_time,
                            "old_hash": monitor["last_hash"],
                            "new_hash": current_hash,
                            "status_code": result["status_code"],
                            "change_type": "Response changed"
                        })
                        monitor["changes_detected"] = monitor.get("changes_detected", 0) + 1

                    monitor["last_hash"] = current_hash
                    monitor["last_response"] = result
                    monitor["status"] = "active"
                else:
                    monitor["status"] = "error"
                    monitor["last_error"] = result.get("error")

                monitor["last_check"] = current_time

            # Wait before next check (use minimum interval from all monitors)
            await asyncio.sleep(60)  # Check every minute, individual monitors have their own intervals

        except Exception as e:
            print(f"Monitoring loop error: {e}")
            await asyncio.sleep(60)


@router.on_event("startup")
async def startup_event():
    """Start the monitoring loop when the plugin loads"""
    global monitoring_task
    monitoring_task = asyncio.create_task(monitoring_loop())


@router.on_event("shutdown")
async def shutdown_event():
    """Stop the monitoring loop when the plugin unloads"""
    global monitoring_task
    if monitoring_task:
        monitoring_task.cancel()


@router.post("/dns-monitors", response_model=Dict[str, str])
async def add_dns_monitor(monitor: DNSMonitor):
    """Add a new DNS CNAME monitor"""
    monitor_id = hashlib.md5(f"{monitor.domain}".encode()).hexdigest()[:8]

    # Initial check
    cname = await check_dns_cname(monitor.domain)

    dns_monitors[monitor_id] = {
        "id": monitor_id,
        "domain": monitor.domain,
        "check_interval": monitor.check_interval,
        "last_cname": cname,
        "last_check": datetime.now().isoformat(),
        "history": [],
        "changes_detected": 0,
        "status": "active"
    }

    return {"id": monitor_id, "message": f"DNS monitor added for {monitor.domain}"}


@router.post("/api-monitors", response_model=Dict[str, str])
async def add_api_monitor(monitor: APIMonitor):
    """Add a new API endpoint monitor"""
    monitor_id = hashlib.md5(f"{monitor.url}{monitor.method}".encode()).hexdigest()[:8]

    # Initial check
    result = await check_api_response(monitor.url, monitor.method, monitor.headers, monitor.body)

    api_monitors[monitor_id] = {
        "id": monitor_id,
        "url": monitor.url,
        "method": monitor.method,
        "headers": monitor.headers,
        "body": monitor.body,
        "check_interval": monitor.check_interval,
        "last_hash": result.get("content_hash") if result.get("success") else None,
        "last_response": result if result.get("success") else None,
        "last_check": datetime.now().isoformat(),
        "history": [],
        "changes_detected": 0,
        "status": "active" if result.get("success") else "error"
    }

    return {"id": monitor_id, "message": f"API monitor added for {monitor.url}"}


@router.get("/dns-monitors")
async def get_dns_monitors():
    """Get all DNS monitors"""
    return list(dns_monitors.values())


@router.get("/api-monitors")
async def get_api_monitors():
    """Get all API monitors"""
    return list(api_monitors.values())


@router.get("/monitors")
async def get_all_monitors():
    """Get all monitors (DNS and API)"""
    return {
        "dns": list(dns_monitors.values()),
        "api": list(api_monitors.values())
    }


@router.delete("/dns-monitors/{monitor_id}")
async def delete_dns_monitor(monitor_id: str):
    """Delete a DNS monitor"""
    if monitor_id in dns_monitors:
        del dns_monitors[monitor_id]
        return {"message": "DNS monitor deleted"}
    raise HTTPException(status_code=404, detail="Monitor not found")


@router.delete("/api-monitors/{monitor_id}")
async def delete_api_monitor(monitor_id: str):
    """Delete an API monitor"""
    if monitor_id in api_monitors:
        del api_monitors[monitor_id]
        return {"message": "API monitor deleted"}
    raise HTTPException(status_code=404, detail="Monitor not found")


@router.get("/dns-monitors/{monitor_id}/history")
async def get_dns_monitor_history(monitor_id: str):
    """Get history for a specific DNS monitor"""
    if monitor_id in dns_monitors:
        return dns_monitors[monitor_id]["history"]
    raise HTTPException(status_code=404, detail="Monitor not found")


@router.get("/api-monitors/{monitor_id}/history")
async def get_api_monitor_history(monitor_id: str):
    """Get history for a specific API monitor"""
    if monitor_id in api_monitors:
        return api_monitors[monitor_id]["history"]
    raise HTTPException(status_code=404, detail="Monitor not found")


@router.post("/dns-monitors/{monitor_id}/check")
async def manual_dns_check(monitor_id: str):
    """Manually trigger a DNS check"""
    if monitor_id not in dns_monitors:
        raise HTTPException(status_code=404, detail="Monitor not found")

    monitor = dns_monitors[monitor_id]
    cname = await check_dns_cname(monitor["domain"])
    current_time = datetime.now().isoformat()

    # Check if CNAME changed
    if monitor["last_cname"] is not None and monitor["last_cname"] != cname:
        monitor["history"].append({
            "timestamp": current_time,
            "old_value": monitor["last_cname"],
            "new_value": cname,
            "change_type": "CNAME changed (manual check)"
        })
        monitor["changes_detected"] = monitor.get("changes_detected", 0) + 1

    monitor["last_cname"] = cname
    monitor["last_check"] = current_time

    return {
        "current_value": cname,
        "changed": monitor["last_cname"] != cname if monitor.get("last_cname") else False
    }


@router.post("/api-monitors/{monitor_id}/check")
async def manual_api_check(monitor_id: str):
    """Manually trigger an API check"""
    if monitor_id not in api_monitors:
        raise HTTPException(status_code=404, detail="Monitor not found")

    monitor = api_monitors[monitor_id]
    result = await check_api_response(
        monitor["url"],
        monitor.get("method", "GET"),
        monitor.get("headers"),
        monitor.get("body")
    )
    current_time = datetime.now().isoformat()

    if result["success"]:
        current_hash = result["content_hash"]

        # Check if response changed
        changed = False
        if monitor["last_hash"] is not None and monitor["last_hash"] != current_hash:
            monitor["history"].append({
                "timestamp": current_time,
                "old_hash": monitor["last_hash"],
                "new_hash": current_hash,
                "status_code": result["status_code"],
                "change_type": "Response changed (manual check)"
            })
            monitor["changes_detected"] = monitor.get("changes_detected", 0) + 1
            changed = True

        monitor["last_hash"] = current_hash
        monitor["last_response"] = result
        monitor["status"] = "active"
        monitor["last_check"] = current_time

        return {
            "status_code": result["status_code"],
            "content_hash": current_hash,
            "changed": changed
        }
    else:
        monitor["status"] = "error"
        monitor["last_error"] = result.get("error")
        monitor["last_check"] = current_time
        raise HTTPException(status_code=500, detail=result.get("error"))
