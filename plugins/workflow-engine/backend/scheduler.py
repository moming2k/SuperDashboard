from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from typing import Dict, Callable
import logging

logger = logging.getLogger(__name__)


class WorkflowScheduler:
    """Manages scheduled workflow executions using APScheduler"""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.scheduled_workflows: Dict[str, str] = {}  # workflow_id -> job_id

    def start(self):
        """Start the scheduler"""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("Workflow scheduler started")

    def stop(self):
        """Stop the scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Workflow scheduler stopped")

    def schedule_workflow(
        self,
        workflow_id: str,
        cron_expression: str,
        execute_callback: Callable
    ):
        """
        Schedule a workflow with cron expression

        Args:
            workflow_id: Workflow identifier
            cron_expression: Cron expression (e.g., "0 9 * * *" for 9am daily)
            execute_callback: Async function to call when triggered
        """
        # Remove existing schedule if any
        self.unschedule_workflow(workflow_id)

        try:
            # Parse cron expression
            # Format: minute hour day month day_of_week
            parts = cron_expression.split()

            if len(parts) != 5:
                raise ValueError(f"Invalid cron expression: {cron_expression}. Expected 5 parts.")

            minute, hour, day, month, day_of_week = parts

            # Add job to scheduler
            job = self.scheduler.add_job(
                execute_callback,
                trigger=CronTrigger(
                    minute=minute,
                    hour=hour,
                    day=day,
                    month=month,
                    day_of_week=day_of_week
                ),
                id=f"workflow_{workflow_id}",
                replace_existing=True,
                kwargs={'workflow_id': workflow_id}
            )

            self.scheduled_workflows[workflow_id] = job.id
            logger.info(f"Scheduled workflow {workflow_id} with cron: {cron_expression}")

        except Exception as e:
            logger.error(f"Failed to schedule workflow {workflow_id}: {str(e)}")
            raise

    def unschedule_workflow(self, workflow_id: str):
        """Remove workflow schedule"""
        job_id = self.scheduled_workflows.get(workflow_id)

        if job_id:
            try:
                self.scheduler.remove_job(job_id)
                del self.scheduled_workflows[workflow_id]
                logger.info(f"Unscheduled workflow {workflow_id}")
            except Exception as e:
                logger.warning(f"Failed to unschedule workflow {workflow_id}: {str(e)}")

    def get_scheduled_workflows(self) -> Dict[str, any]:
        """Get list of scheduled workflows with next run time"""
        result = {}

        for workflow_id, job_id in self.scheduled_workflows.items():
            job = self.scheduler.get_job(job_id)
            if job:
                result[workflow_id] = {
                    'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                    'trigger': str(job.trigger)
                }

        return result

    def is_scheduled(self, workflow_id: str) -> bool:
        """Check if workflow is scheduled"""
        return workflow_id in self.scheduled_workflows
