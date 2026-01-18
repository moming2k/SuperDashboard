"""
Configuration and startup validation for SuperDashboard
Validates environment variables and provides configuration object
"""
import os
import sys
from typing import Optional
from dotenv import load_dotenv
from logger import config_logger, log_config_validated, log_config_error, log_config_warning

# Load environment variables
load_dotenv()


class Config:
    """Configuration object with validation"""

    def __init__(self):
        # Database (REQUIRED)
        self.database_url: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/superdashboard")

        cors_origins = os.getenv("CORS_ORIGINS", "*")
        if cors_origins == "*":
            # Allow all origins plus explicit local development URLs
            self.allowed_origins = [
                "*",
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:8000",
                "http://127.0.0.1:8000"
            ]
        else:
            self.allowed_origins = [origin.strip() for origin in cors_origins.split(",")]

        # OpenAI Configuration (Optional)
        self.openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")

        # Jira Configuration (Optional)
        self.jira_url: Optional[str] = os.getenv("JIRA_URL")
        self.jira_email: Optional[str] = os.getenv("JIRA_EMAIL")
        self.jira_api_token: Optional[str] = os.getenv("JIRA_API_TOKEN")
        self.jira_jql: str = os.getenv("JIRA_JQL", "order by created DESC")

        # Twilio Configuration (Optional)
        self.twilio_account_sid: Optional[str] = os.getenv("TWILIO_ACCOUNT_SID")
        self.twilio_auth_token: Optional[str] = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_whatsapp_number: Optional[str] = os.getenv("TWILIO_WHATSAPP_NUMBER")

        # Server Configuration
        self.is_devcontainer: bool = os.getenv("DEVCONTAINER", "false").lower() == "true"
        self.default_port: int = 18010 if self.is_devcontainer else 8000
        self.port: int = int(os.getenv("PORT", self.default_port))
        self.host: str = os.getenv("HOST", "0.0.0.0")

    def validate(self) -> tuple[bool, list[str]]:
        """
        Validate configuration
        Returns (is_valid, list_of_errors)
        """
        errors = []

        # Check required configuration
        if not self.database_url:
            errors.append("DATABASE_URL is required")

        # Validate database URL format
        if self.database_url and not self.database_url.startswith("postgresql://"):
            errors.append("DATABASE_URL must be a PostgreSQL connection string (postgresql://...)")

        return (len(errors) == 0, errors)

    def get_warnings(self) -> list[str]:
        """
        Get list of warnings for optional configuration
        """
        warnings = []

        if not self.openai_api_key:
            warnings.append("OPENAI_API_KEY not set - AI features will be disabled")

        if not all([self.jira_url, self.jira_email, self.jira_api_token]):
            warnings.append("Jira credentials not configured - Jira plugin will not function")

        if not all([self.twilio_account_sid, self.twilio_auth_token]):
            warnings.append("Twilio credentials not configured - WhatsApp plugin will not function")

        return warnings


# Global configuration instance
config = Config()


def validate_startup_config():
    """
    Validate configuration at startup
    Exits with error if required configuration is missing
    """
    is_valid, errors = config.validate()

    if not is_valid:
        config_logger.critical("Configuration validation failed!")
        config_logger.critical("Errors:")
        for error in errors:
            log_config_error(error)
        config_logger.critical("Please check your .env file and ensure all required variables are set.")
        config_logger.critical("See backend/.env.example for reference.")
        sys.exit(1)

    # Log warnings
    warnings = config.get_warnings()
    if warnings:
        for warning in warnings:
            log_config_warning(warning)

    log_config_validated()
    config_logger.info(f"Database: {config.database_url.split('@')[-1] if '@' in config.database_url else config.database_url}")
    config_logger.info(f"CORS Origins: {config.allowed_origins}")
    config_logger.info(f"Server: {config.host}:{config.port}")


if __name__ == "__main__":
    # Test configuration validation
    validate_startup_config()
