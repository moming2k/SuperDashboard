from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import sys
import os

# Add paths for imports
plugin_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, plugin_root)

from shared.database import Base

class Workflow(Base):
    __tablename__ = 'workflows'

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    enabled = Column(Boolean, default=True)
    schedule = Column(String, nullable=True)  # Cron expression
    nodes = Column(JSON, default=[])  # Store nodes as JSON array
    edges = Column(JSON, default=[])  # Store edges as JSON array
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to executions
    executions = relationship("WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'enabled': self.enabled,
            'schedule': self.schedule,
            'nodes': self.nodes,
            'edges': self.edges,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class WorkflowExecution(Base):
    __tablename__ = 'workflow_executions'

    id = Column(String, primary_key=True)
    workflow_id = Column(String, ForeignKey('workflows.id'), nullable=False)
    status = Column(String, default='pending')  # pending, running, completed, failed
    trigger_type = Column(String, nullable=True)  # schedule, manual, webhook
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    logs = Column(JSON, default=[])  # Execution logs as JSON array
    result = Column(JSON, nullable=True)  # Final result as JSON
    error = Column(Text, nullable=True)  # Error message if failed

    # Relationship to workflow
    workflow = relationship("Workflow", back_populates="executions")

    def to_dict(self):
        return {
            'id': self.id,
            'workflow_id': self.workflow_id,
            'status': self.status,
            'trigger_type': self.trigger_type,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'logs': self.logs,
            'result': self.result,
            'error': self.error
        }
