"""
Structured logging configuration for SuperDashboard
Provides consistent logging across all modules with colored output and proper levels
"""
import logging
import sys
from datetime import datetime
from typing import Optional


class ColoredFormatter(logging.Formatter):
    """Custom formatter with colored output for different log levels"""

    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
        'RESET': '\033[0m'        # Reset
    }

    # Emoji prefixes for better visibility
    EMOJI = {
        'DEBUG': '🔍',
        'INFO': '✅',
        'WARNING': '⚠️',
        'ERROR': '❌',
        'CRITICAL': '🚨'
    }

    def format(self, record):
        # Add color and emoji
        color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
        emoji = self.EMOJI.get(record.levelname, '📝')
        reset = self.COLORS['RESET']

        # Format: [TIMESTAMP] EMOJI LEVEL - message
        record.levelname_colored = f"{color}{emoji} {record.levelname}{reset}"

        return super().format(record)


def setup_logger(
    name: str = "superdashboard",
    level: int = logging.INFO,
    log_file: Optional[str] = None
) -> logging.Logger:
    """
    Set up a logger with consistent formatting

    Args:
        name: Logger name (typically module name)
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Optional file path to also log to a file

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Remove existing handlers to avoid duplicates
    logger.handlers.clear()

    # Console handler with colored output
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)

    # Format: [2025-01-04 12:34:56] ✅ INFO - Message here
    console_formatter = ColoredFormatter(
        '[%(asctime)s] %(levelname_colored)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    # Optional file handler (without colors)
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(level)
        file_formatter = logging.Formatter(
            '[%(asctime)s] %(levelname)s - %(name)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)

    # Prevent propagation to root logger
    logger.propagate = False

    return logger


# Global logger instances for common use
app_logger = setup_logger("superdashboard.app", level=logging.INFO)
plugin_logger = setup_logger("superdashboard.plugins", level=logging.INFO)
db_logger = setup_logger("superdashboard.db", level=logging.INFO)
config_logger = setup_logger("superdashboard.config", level=logging.INFO)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger for a specific module

    Args:
        name: Module name (e.g., "superdashboard.routes.tasks")

    Returns:
        Configured logger instance
    """
    return setup_logger(name)


# Convenience functions for quick logging
def log_startup(message: str):
    """Log startup messages"""
    app_logger.info(f"🚀 {message}")


def log_plugin_loaded(plugin_name: str, path: str):
    """Log successful plugin load"""
    plugin_logger.info(f"Loaded plugin: {plugin_name} from {path}")


def log_plugin_failed(plugin_name: str, error: str):
    """Log plugin load failure"""
    plugin_logger.error(f"Failed to load plugin {plugin_name}: {error}")


def log_plugin_disabled(plugin_name: str):
    """Log disabled plugin"""
    plugin_logger.info(f"Plugin {plugin_name} is disabled, skipping load")


def log_config_validated():
    """Log successful configuration validation"""
    config_logger.info("Configuration validated successfully")


def log_config_error(error: str):
    """Log configuration error"""
    config_logger.error(f"Configuration error: {error}")


def log_config_warning(warning: str):
    """Log configuration warning"""
    config_logger.warning(f"Configuration warning: {warning}")


def log_db_initialized():
    """Log database initialization"""
    db_logger.info("Database tables initialized in PostgreSQL")


def log_db_error(error: str):
    """Log database error"""
    db_logger.error(f"Database error: {error}")


# Example usage:
if __name__ == "__main__":
    # Test different log levels
    logger = get_logger("test")
    logger.debug("This is a debug message")
    logger.info("This is an info message")
    logger.warning("This is a warning message")
    logger.error("This is an error message")
    logger.critical("This is a critical message")

    # Test convenience functions
    log_startup("SuperDashboard starting up")
    log_plugin_loaded("jira", "/path/to/plugin")
    log_plugin_failed("broken-plugin", "Import error")
    log_config_validated()
