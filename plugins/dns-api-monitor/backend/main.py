from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
import asyncio
import httpx
import dns.resolver
from datetime import datetime
import hashlib
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
from plugins.shared.database import get_db, init_db

# Import database models - use direct import to avoid module name issues
import importlib.util
spec = importlib.util.spec_from_file_location(
    "dns_monitor_db",
    os.path.join(os.path.dirname(__file__), "database.py")
)
dns_monitor_db_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dns_monitor_db_module)
DBDNSMonitor = dns_monitor_db_module.DNSMonitor
DBDNSHistory = dns_monitor_db_module.DNSMonitorHistory
DBAPIMonitor = dns_monitor_db_module.APIMonitor
DBAPIHistory = dns_monitor_db_module.APIMonitorHistory

router = APIRouter()

# Initialize database tables on module load
try:
    init_db()
    print("📡 DNS & API Monitor database tables initialized")
except Exception as e:
    print(f"⚠️  DNS & API Monitor database initialization warning: {e}")

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
    from plugins.shared.database import SessionLocal
    
    while True:
        db = SessionLocal()
        try:
            # Check DNS monitors
            dns_monitors = db.query(DBDNSMonitor).filter(DBDNSMonitor.status == "active").all()
            for monitor in dns_monitors:
                current_time = datetime.now()
                cname = await check_dns_cname(monitor.domain)

                # Check if CNAME changed
                if monitor.last_cname is not None and monitor.last_cname != cname:
                    history_entry = DBDNSHistory(
                        monitor_id=monitor.id,
                        timestamp=current_time,
                        old_value=monitor.last_cname,
                        new_value=cname,
                        change_type="CNAME changed"
                    )
                    db.add(history_entry)
                    monitor.changes_detected = (monitor.changes_detected or 0) + 1

                monitor.last_cname = cname
                monitor.last_check = current_time
                monitor.status = "active"

            # Check API monitors
            api_monitors = db.query(DBAPIMonitor).filter(DBAPIMonitor.status == "active").all()
            for monitor in api_monitors:
                current_time = datetime.now()
                result = await check_api_response(
                    monitor.url,
                    monitor.method or "GET",
                    monitor.headers,
                    monitor.body
                )

                if result["success"]:
                    current_hash = result["content_hash"]

                    # Check if response changed
                    if monitor.last_hash is not None and monitor.last_hash != current_hash:
                        history_entry = DBAPIHistory(
                            monitor_id=monitor.id,
                            timestamp=current_time,
                            old_hash=monitor.last_hash,
                            new_hash=current_hash,
                            status_code=result["status_code"],
                            change_type="Response changed"
                        )
                        db.add(history_entry)
                        monitor.changes_detected = (monitor.changes_detected or 0) + 1

                    monitor.last_hash = current_hash
                    monitor.last_response = result
                    monitor.status = "active"
                else:
                    monitor.status = "error"
                    monitor.last_error = result.get("error")

                monitor.last_check = current_time

            db.commit()
            
            # Wait before next check
            await asyncio.sleep(60)  # Check every minute

        except Exception as e:
            print(f"Monitoring loop error: {e}")
            db.rollback()
            await asyncio.sleep(60)
        finally:
            db.close()


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
async def add_dns_monitor(monitor: DNSMonitor, db: Session = Depends(get_db)):
    """Add a new DNS CNAME monitor"""
    monitor_id = hashlib.md5(f"{monitor.domain}".encode()).hexdigest()[:8]

    # Check if monitor already exists
    existing = db.query(DBDNSMonitor).filter(DBDNSMonitor.id == monitor_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Monitor for this domain already exists")

    # Initial check
    cname = await check_dns_cname(monitor.domain)

    db_monitor = DBDNSMonitor(
        id=monitor_id,
        domain=monitor.domain,
        check_interval=monitor.check_interval,
        last_cname=cname,
        last_check=datetime.now(),
        changes_detected=0,
        status="active"
    )
    
    db.add(db_monitor)
    db.commit()

    return {"id": monitor_id, "message": f"DNS monitor added for {monitor.domain}"}


@router.post("/api-monitors", response_model=Dict[str, str])
async def add_api_monitor(monitor: APIMonitor, db: Session = Depends(get_db)):
    """Add a new API endpoint monitor"""
    monitor_id = hashlib.md5(f"{monitor.url}{monitor.method}".encode()).hexdigest()[:8]

    # Check if monitor already exists
    existing = db.query(DBAPIMonitor).filter(DBAPIMonitor.id == monitor_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Monitor for this URL and method already exists")

    # Initial check
    result = await check_api_response(monitor.url, monitor.method, monitor.headers, monitor.body)

    db_monitor = DBAPIMonitor(
        id=monitor_id,
        url=monitor.url,
        method=monitor.method,
        headers=monitor.headers,
        body=monitor.body,
        check_interval=monitor.check_interval,
        last_hash=result.get("content_hash") if result.get("success") else None,
        last_response=result if result.get("success") else None,
        last_check=datetime.now(),
        changes_detected=0,
        status="active" if result.get("success") else "error"
    )
    
    db.add(db_monitor)
    db.commit()

    return {"id": monitor_id, "message": f"API monitor added for {monitor.url}"}


@router.get("/dns-monitors")
async def get_dns_monitors(db: Session = Depends(get_db)):
    """Get all DNS monitors"""
    monitors = db.query(DBDNSMonitor).all()
    return [{
        "id": m.id,
        "domain": m.domain,
        "check_interval": m.check_interval,
        "last_cname": m.last_cname,
        "last_check": m.last_check.isoformat() if m.last_check else None,
        "changes_detected": m.changes_detected or 0,
        "status": m.status,
        "history": [
            {
                "timestamp": h.timestamp.isoformat(),
                "old_value": h.old_value,
                "new_value": h.new_value,
                "change_type": h.change_type
            }
            for h in db.query(DBDNSHistory).filter(DBDNSHistory.monitor_id == m.id).order_by(DBDNSHistory.timestamp.desc()).limit(50).all()
        ]
    } for m in monitors]


@router.get("/api-monitors")
async def get_api_monitors(db: Session = Depends(get_db)):
    """Get all API monitors"""
    monitors = db.query(DBAPIMonitor).all()
    return [{
        "id": m.id,
        "url": m.url,
        "method": m.method,
        "headers": m.headers,
        "body": m.body,
        "check_interval": m.check_interval,
        "last_hash": m.last_hash,
        "last_response": m.last_response,
        "last_check": m.last_check.isoformat() if m.last_check else None,
        "last_error": m.last_error,
        "changes_detected": m.changes_detected or 0,
        "status": m.status,
        "history": [
            {
                "timestamp": h.timestamp.isoformat(),
                "old_hash": h.old_hash,
                "new_hash": h.new_hash,
                "status_code": h.status_code,
                "change_type": h.change_type
            }
            for h in db.query(DBAPIHistory).filter(DBAPIHistory.monitor_id == m.id).order_by(DBAPIHistory.timestamp.desc()).limit(50).all()
        ]
    } for m in monitors]


@router.get("/monitors")
async def get_all_monitors(db: Session = Depends(get_db)):
    """Get all monitors (DNS and API)"""
    dns = await get_dns_monitors(db)
    api = await get_api_monitors(db)
    return {
        "dns": dns,
        "api": api
    }


@router.delete("/dns-monitors/{monitor_id}")
async def delete_dns_monitor(monitor_id: str, db: Session = Depends(get_db)):
    """Delete a DNS monitor"""
    monitor = db.query(DBDNSMonitor).filter(DBDNSMonitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    
    # Delete history entries (cascade should handle this, but being explicit)
    db.query(DBDNSHistory).filter(DBDNSHistory.monitor_id == monitor_id).delete()
    db.delete(monitor)
    db.commit()
    
    return {"message": "DNS monitor deleted"}


@router.delete("/api-monitors/{monitor_id}")
async def delete_api_monitor(monitor_id: str, db: Session = Depends(get_db)):
    """Delete an API monitor"""
    monitor = db.query(DBAPIMonitor).filter(DBAPIMonitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    
    # Delete history entries
    db.query(DBAPIHistory).filter(DBAPIHistory.monitor_id == monitor_id).delete()
    db.delete(monitor)
    db.commit()
    
    return {"message": "API monitor deleted"}


@router.get("/dns-monitors/{monitor_id}/history")
async def get_dns_monitor_history(monitor_id: str, db: Session = Depends(get_db)):
    """Get history for a specific DNS monitor"""
    monitor = db.query(DBDNSMonitor).filter(DBDNSMonitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    
    history = db.query(DBDNSHistory).filter(
        DBDNSHistory.monitor_id == monitor_id
    ).order_by(DBDNSHistory.timestamp.desc()).all()
    
    return [{
        "timestamp": h.timestamp.isoformat(),
        "old_value": h.old_value,
        "new_value": h.new_value,
        "change_type": h.change_type
    } for h in history]


@router.get("/api-monitors/{monitor_id}/history")
async def get_api_monitor_history(monitor_id: str, db: Session = Depends(get_db)):
    """Get history for a specific API monitor"""
    monitor = db.query(DBAPIMonitor).filter(DBAPIMonitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    
    history = db.query(DBAPIHistory).filter(
        DBAPIHistory.monitor_id == monitor_id
    ).order_by(DBAPIHistory.timestamp.desc()).all()
    
    return [{
        "timestamp": h.timestamp.isoformat(),
        "old_hash": h.old_hash,
        "new_hash": h.new_hash,
        "status_code": h.status_code,
        "change_type": h.change_type
    } for h in history]


@router.post("/dns-monitors/{monitor_id}/check")
async def manual_dns_check(monitor_id: str, db: Session = Depends(get_db)):
    """Manually trigger a DNS check"""
    monitor = db.query(DBDNSMonitor).filter(DBDNSMonitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    cname = await check_dns_cname(monitor.domain)
    current_time = datetime.now()

    # Check if CNAME changed
    changed = False
    if monitor.last_cname is not None and monitor.last_cname != cname:
        history_entry = DBDNSHistory(
            monitor_id=monitor.id,
            timestamp=current_time,
            old_value=monitor.last_cname,
            new_value=cname,
            change_type="CNAME changed (manual check)"
        )
        db.add(history_entry)
        monitor.changes_detected = (monitor.changes_detected or 0) + 1
        changed = True

    monitor.last_cname = cname
    monitor.last_check = current_time
    db.commit()

    return {
        "current_value": cname,
        "changed": changed
    }


@router.post("/api-monitors/{monitor_id}/check")
async def manual_api_check(monitor_id: str, db: Session = Depends(get_db)):
    """Manually trigger an API check"""
    monitor = db.query(DBAPIMonitor).filter(DBAPIMonitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    result = await check_api_response(
        monitor.url,
        monitor.method or "GET",
        monitor.headers,
        monitor.body
    )
    current_time = datetime.now()

    if result["success"]:
        current_hash = result["content_hash"]

        # Check if response changed
        changed = False
        if monitor.last_hash is not None and monitor.last_hash != current_hash:
            history_entry = DBAPIHistory(
                monitor_id=monitor.id,
                timestamp=current_time,
                old_hash=monitor.last_hash,
                new_hash=current_hash,
                status_code=result["status_code"],
                change_type="Response changed (manual check)"
            )
            db.add(history_entry)
            monitor.changes_detected = (monitor.changes_detected or 0) + 1
            changed = True

        monitor.last_hash = current_hash
        monitor.last_response = result
        monitor.status = "active"
        monitor.last_check = current_time
        db.commit()

        return {
            "status_code": result["status_code"],
            "content_hash": current_hash,
            "changed": changed
        }
    else:
        monitor.status = "error"
        monitor.last_error = result.get("error")
        monitor.last_check = current_time
        db.commit()
        raise HTTPException(status_code=500, detail=result.get("error"))
