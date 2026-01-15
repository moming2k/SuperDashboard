import os
import sys
import importlib.util
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
import uuid

# Add paths for imports
plugin_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, plugin_root)

from shared.database import get_db, init_db

# Load models using importlib to avoid conflicts
models_path = os.path.join(os.path.dirname(__file__), 'models.py')
spec = importlib.util.spec_from_file_location("workflow_models", models_path)
workflow_models = importlib.util.module_from_spec(spec)
spec.loader.exec_module(workflow_models)
WorkflowModel = workflow_models.Workflow
WorkflowExecutionModel = workflow_models.WorkflowExecution

# Import executor and scheduler using importlib
executor_path = os.path.join(os.path.dirname(__file__), 'executor.py')
spec = importlib.util.spec_from_file_location("workflow_executor", executor_path)
workflow_executor_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(workflow_executor_module)
WorkflowExecutor = workflow_executor_module.WorkflowExecutor

scheduler_path = os.path.join(os.path.dirname(__file__), 'scheduler.py')
spec = importlib.util.spec_from_file_location("workflow_scheduler", scheduler_path)
workflow_scheduler_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(workflow_scheduler_module)
WorkflowScheduler = workflow_scheduler_module.WorkflowScheduler

router = APIRouter()

# Initialize executor and scheduler
executor = WorkflowExecutor()
scheduler = WorkflowScheduler()

# Database availability flag
database_available = False

# Initialize database tables
try:
    init_db()
    database_available = True
    print("⚙️  Workflow Engine database tables initialized")
except Exception as e:
    print(f"⚠️  Workflow Engine database initialization error: {e}")
    print("   Plugin will work with limited functionality")

# Start scheduler
# Commented out to prevent event loop error during module load
# The scheduler will start automatically when the first workflow is scheduled
# scheduler.start()
# print("⚙️  Workflow scheduler started")


# ==================== Pydantic Models ====================

class WorkflowNode(BaseModel):
    id: str
    type: str  # trigger, plugin-action, condition, delay, transform
    position: Dict[str, float]  # x, y coordinates
    data: Dict[str, Any]  # Node configuration

class WorkflowEdge(BaseModel):
    id: str
    source: str  # source node id
    target: str  # target node id
    condition: Optional[Dict[str, Any]] = None  # Optional edge condition

class Workflow(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    enabled: bool = True
    schedule: Optional[str] = None  # Cron expression
    nodes: List[WorkflowNode]
    edges: List[WorkflowEdge]

class WorkflowExecution(BaseModel):
    id: Optional[str] = None
    workflow_id: str
    status: str = 'pending'
    trigger_type: Optional[str] = 'manual'
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    logs: List[Dict[str, Any]] = []
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ExecuteWorkflowRequest(BaseModel):
    workflow_id: str


# ==================== Helper Functions ====================

async def execute_workflow_callback(workflow_id: str):
    """Callback function for scheduled workflow execution"""
    try:
        print(f"⚙️  Executing scheduled workflow: {workflow_id}")

        # Get workflow from database
        db = next(get_db())
        workflow_db = db.query(WorkflowModel).filter(WorkflowModel.id == workflow_id).first()

        if not workflow_db or not workflow_db.enabled:
            print(f"⚠️  Workflow {workflow_id} not found or disabled")
            return

        # Execute workflow
        await execute_workflow_internal(workflow_id, workflow_db, db, trigger_type="schedule")

    except Exception as e:
        print(f"❌ Error executing scheduled workflow {workflow_id}: {str(e)}")


async def execute_workflow_internal(
    workflow_id: str,
    workflow_db: WorkflowModel,
    db: Session,
    trigger_type: str = "manual"
) -> WorkflowExecutionModel:
    """Internal function to execute workflow and store execution"""

    # Create execution record
    execution_id = str(uuid.uuid4())
    execution = WorkflowExecutionModel(
        id=execution_id,
        workflow_id=workflow_id,
        status='running',
        trigger_type=trigger_type,
        start_time=datetime.utcnow()
    )
    db.add(execution)
    db.commit()

    try:
        # Execute workflow
        result = await executor.execute_workflow(
            workflow_id=workflow_id,
            nodes=[node.dict() if hasattr(node, 'dict') else node for node in workflow_db.nodes],
            edges=[edge.dict() if hasattr(edge, 'dict') else edge for edge in workflow_db.edges],
            trigger_type=trigger_type
        )

        # Update execution record
        execution.status = result.get('status', 'completed')
        execution.end_time = datetime.utcnow()
        execution.logs = result.get('logs', [])
        execution.result = result.get('result')
        execution.error = result.get('error')
        db.commit()

        return execution

    except Exception as e:
        execution.status = 'failed'
        execution.end_time = datetime.utcnow()
        execution.error = str(e)
        db.commit()
        raise


# ==================== API Endpoints ====================

@router.get("/health")
async def health_check():
    """Check workflow engine health"""
    return {
        "status": "healthy",
        "scheduler_running": scheduler.scheduler.running,
        "scheduled_workflows": len(scheduler.scheduled_workflows),
        "database_available": database_available
    }


@router.get("/workflows")
async def get_workflows(db: Session = Depends(get_db)):
    """Get all workflows"""
    workflows = db.query(WorkflowModel).order_by(WorkflowModel.created_at.desc()).all()
    return [workflow.to_dict() for workflow in workflows]


@router.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str, db: Session = Depends(get_db)):
    """Get a specific workflow"""
    workflow = db.query(WorkflowModel).filter(WorkflowModel.id == workflow_id).first()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return workflow.to_dict()


@router.post("/workflows")
async def create_workflow(workflow: Workflow, db: Session = Depends(get_db)):
    """Create a new workflow"""
    try:
        # Generate ID if not provided
        workflow_id = workflow.id or str(uuid.uuid4())

        # Convert nodes and edges to dict format
        nodes_data = [node.dict() for node in workflow.nodes]
        edges_data = [edge.dict() for edge in workflow.edges]

        # Create workflow in database
        workflow_db = WorkflowModel(
            id=workflow_id,
            name=workflow.name,
            description=workflow.description,
            enabled=workflow.enabled,
            schedule=workflow.schedule,
            nodes=nodes_data,
            edges=edges_data
        )
        db.add(workflow_db)
        db.commit()

        # Schedule workflow if it has a schedule and is enabled
        if workflow.schedule and workflow.enabled:
            scheduler.schedule_workflow(
                workflow_id=workflow_id,
                cron_expression=workflow.schedule,
                execute_callback=execute_workflow_callback
            )

        return workflow_db.to_dict()

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create workflow: {str(e)}")


@router.put("/workflows/{workflow_id}")
async def update_workflow(workflow_id: str, workflow: Workflow, db: Session = Depends(get_db)):
    """Update an existing workflow"""
    try:
        workflow_db = db.query(WorkflowModel).filter(WorkflowModel.id == workflow_id).first()

        if not workflow_db:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Convert nodes and edges to dict format
        nodes_data = [node.dict() for node in workflow.nodes]
        edges_data = [edge.dict() for edge in workflow.edges]

        # Update workflow
        workflow_db.name = workflow.name
        workflow_db.description = workflow.description
        workflow_db.enabled = workflow.enabled
        workflow_db.schedule = workflow.schedule
        workflow_db.nodes = nodes_data
        workflow_db.edges = edges_data
        workflow_db.updated_at = datetime.utcnow()
        db.commit()

        # Update schedule
        if workflow.schedule and workflow.enabled:
            scheduler.schedule_workflow(
                workflow_id=workflow_id,
                cron_expression=workflow.schedule,
                execute_callback=execute_workflow_callback
            )
        else:
            scheduler.unschedule_workflow(workflow_id)

        return workflow_db.to_dict()

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update workflow: {str(e)}")


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str, db: Session = Depends(get_db)):
    """Delete a workflow"""
    try:
        workflow_db = db.query(WorkflowModel).filter(WorkflowModel.id == workflow_id).first()

        if not workflow_db:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Unschedule workflow
        scheduler.unschedule_workflow(workflow_id)

        # Delete workflow (executions will be cascade deleted)
        db.delete(workflow_db)
        db.commit()

        return {"status": "deleted", "workflow_id": workflow_id}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete workflow: {str(e)}")


@router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(workflow_id: str, db: Session = Depends(get_db)):
    """Manually execute a workflow"""
    try:
        workflow_db = db.query(WorkflowModel).filter(WorkflowModel.id == workflow_id).first()

        if not workflow_db:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Execute workflow
        execution = await execute_workflow_internal(
            workflow_id=workflow_id,
            workflow_db=workflow_db,
            db=db,
            trigger_type="manual"
        )

        return execution.to_dict()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute workflow: {str(e)}")


@router.post("/workflows/{workflow_id}/toggle")
async def toggle_workflow(workflow_id: str, enabled: bool, db: Session = Depends(get_db)):
    """Enable or disable a workflow"""
    try:
        workflow_db = db.query(WorkflowModel).filter(WorkflowModel.id == workflow_id).first()

        if not workflow_db:
            raise HTTPException(status_code=404, detail="Workflow not found")

        workflow_db.enabled = enabled
        workflow_db.updated_at = datetime.utcnow()
        db.commit()

        # Update schedule
        if enabled and workflow_db.schedule:
            scheduler.schedule_workflow(
                workflow_id=workflow_id,
                cron_expression=workflow_db.schedule,
                execute_callback=execute_workflow_callback
            )
        else:
            scheduler.unschedule_workflow(workflow_id)

        return workflow_db.to_dict()

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to toggle workflow: {str(e)}")


@router.get("/executions")
async def get_executions(
    workflow_id: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get workflow execution history"""
    query = db.query(WorkflowExecutionModel)

    if workflow_id:
        query = query.filter(WorkflowExecutionModel.workflow_id == workflow_id)

    executions = query.order_by(WorkflowExecutionModel.start_time.desc()).limit(limit).all()
    return [execution.to_dict() for execution in executions]


@router.get("/executions/{execution_id}")
async def get_execution(execution_id: str, db: Session = Depends(get_db)):
    """Get a specific execution"""
    execution = db.query(WorkflowExecutionModel).filter(WorkflowExecutionModel.id == execution_id).first()

    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    return execution.to_dict()


@router.get("/scheduled")
async def get_scheduled_workflows():
    """Get list of scheduled workflows with next run time"""
    return scheduler.get_scheduled_workflows()


@router.get("/available-plugins")
async def get_available_plugins():
    """Get list of available plugins and their actions for workflow nodes"""
    # This will be used by the frontend to build the node palette
    # For now, return a static list of common plugins
    return {
        "plugins": [
            {
                "name": "ai-agent",
                "displayName": "AI Agent",
                "icon": "🤖",
                "actions": [
                    {
                        "id": "ask",
                        "name": "Ask AI",
                        "endpoint": "/chat",
                        "method": "POST",
                        "parameters": {
                            "messages": "array"
                        }
                    }
                ]
            },
            {
                "name": "whatsapp",
                "displayName": "WhatsApp",
                "icon": "💬",
                "actions": [
                    {
                        "id": "send",
                        "name": "Send Message",
                        "endpoint": "/send",
                        "method": "POST",
                        "parameters": {
                            "to": "string",
                            "body": "string"
                        }
                    },
                    {
                        "id": "get-messages",
                        "name": "Get Messages",
                        "endpoint": "/messages",
                        "method": "GET",
                        "parameters": {
                            "phone_number": "string (optional)",
                            "limit": "number (optional)"
                        }
                    }
                ]
            },
            {
                "name": "jira",
                "displayName": "Jira",
                "icon": "🏷️",
                "actions": [
                    {
                        "id": "get-issues",
                        "name": "Get Issues",
                        "endpoint": "/issues",
                        "method": "GET",
                        "parameters": {}
                    }
                ]
            }
        ]
    }


@router.post("/webhook/{node_id}")
async def webhook_trigger(node_id: str, payload: Dict[str, Any] = {}, db: Session = Depends(get_db)):
    """
    Webhook endpoint to trigger workflows via external events.

    This allows plugins like WhatsApp to trigger workflows when events occur.
    The node_id should match a webhook trigger node in a workflow.

    Usage:
    - Configure a webhook trigger node in your workflow
    - Note the node_id from the workflow designer
    - Send POST requests to /plugins/workflow-engine/webhook/{node_id}
    - The payload will be available in the workflow as the trigger node's output
    """
    try:
        # Find workflows that contain this webhook trigger node
        workflows = db.query(WorkflowModel).filter(WorkflowModel.enabled == True).all()

        triggered_workflows = []
        for workflow in workflows:
            # Check if any node in this workflow is the webhook trigger
            for node in workflow.nodes:
                if (node.get('id') == node_id and
                    node.get('type') == 'trigger' and
                    node.get('data', {}).get('triggerType') == 'webhook'):

                    # Execute this workflow
                    execution = await execute_workflow_internal(
                        workflow_id=workflow.id,
                        workflow_db=workflow,
                        db=db,
                        trigger_type="webhook"
                    )
                    triggered_workflows.append({
                        'workflow_id': workflow.id,
                        'workflow_name': workflow.name,
                        'execution_id': execution.id
                    })

        if not triggered_workflows:
            return {
                'status': 'no_workflows',
                'message': f'No enabled workflows found with webhook trigger node: {node_id}'
            }

        return {
            'status': 'triggered',
            'workflows': triggered_workflows,
            'payload': payload
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger webhook: {str(e)}")


# Command Palette Integration
@router.get("/commands")
async def get_commands():
    """Return commands that this plugin provides to the Command Palette"""
    return {
        "commands": [
            {
                "id": "create-workflow",
                "label": "Workflow: Create New Workflow",
                "description": "Create a new workflow",
                "category": "Workflow",
                "icon": "⚙️",
                "action": "navigate",
                "target": "/workflow-engine"
            },
            {
                "id": "list-workflows",
                "label": "Workflow: List All Workflows",
                "description": "View all workflows",
                "category": "Workflow",
                "icon": "📋",
                "endpoint": "/workflows",
                "method": "GET"
            }
        ]
    }
