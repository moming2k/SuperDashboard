import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from main import router, messages_db, WhatsAppMessage

# Create a test FastAPI app
from fastapi import FastAPI
app = FastAPI()
app.include_router(router)

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_messages():
    """Clear messages before each test"""
    messages_db.clear()
    yield
    messages_db.clear()


class TestHealthCheck:
    def test_health_check_not_configured(self):
        """Test health check when WhatsApp is not configured"""
        with patch.dict(os.environ, {"WHATSAPP_TOKEN": "", "WHATSAPP_PHONE_NUMBER_ID": ""}, clear=True):
            response = client.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert data["configured"] is False

    def test_health_check_configured(self):
        """Test health check when WhatsApp is configured"""
        with patch.dict(os.environ, {
            "WHATSAPP_TOKEN": "test_token",
            "WHATSAPP_PHONE_NUMBER_ID": "123456789"
        }):
            response = client.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert data["configured"] is True


class TestWebhookVerification:
    def test_webhook_verification_success(self):
        """Test successful webhook verification"""
        with patch.dict(os.environ, {"WHATSAPP_VERIFY_TOKEN": "test_verify_token"}):
            response = client.get("/webhook", params={
                "hub.mode": "subscribe",
                "hub.verify_token": "test_verify_token",
                "hub.challenge": "12345"
            })
            assert response.status_code == 200
            assert response.json() == 12345

    def test_webhook_verification_failure(self):
        """Test failed webhook verification with wrong token"""
        with patch.dict(os.environ, {"WHATSAPP_VERIFY_TOKEN": "correct_token"}):
            response = client.get("/webhook", params={
                "hub.mode": "subscribe",
                "hub.verify_token": "wrong_token",
                "hub.challenge": "12345"
            })
            assert response.status_code == 403


class TestReceiveWebhook:
    def test_receive_message_webhook(self):
        """Test receiving a message via webhook"""
        webhook_data = {
            "object": "whatsapp_business_account",
            "entry": [{
                "changes": [{
                    "value": {
                        "metadata": {
                            "display_phone_number": "1234567890"
                        },
                        "messages": [{
                            "id": "msg_123",
                            "from": "9876543210",
                            "timestamp": "1609459200",
                            "type": "text",
                            "text": {
                                "body": "Hello, World!"
                            }
                        }]
                    }
                }]
            }]
        }

        response = client.post("/webhook", json=webhook_data)
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert len(messages_db) == 1
        assert messages_db[0].message == "Hello, World!"
        assert messages_db[0].from_number == "9876543210"

    def test_receive_status_update_webhook(self):
        """Test receiving a message status update via webhook"""
        # First add a message
        msg = WhatsAppMessage(
            id="msg_123",
            from_number="1234567890",
            to_number="9876543210",
            message="Test message",
            timestamp="2023-01-01T00:00:00",
            status="sent"
        )
        messages_db.append(msg)

        webhook_data = {
            "object": "whatsapp_business_account",
            "entry": [{
                "changes": [{
                    "value": {
                        "statuses": [{
                            "id": "msg_123",
                            "status": "delivered"
                        }]
                    }
                }]
            }]
        }

        response = client.post("/webhook", json=webhook_data)
        assert response.status_code == 200
        assert messages_db[0].status == "delivered"


class TestSendMessage:
    @patch('httpx.AsyncClient')
    def test_send_message_success(self, mock_client):
        """Test sending a message successfully"""
        # Mock the HTTP response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "messages": [{"id": "msg_456"}]
        }

        mock_client_instance = MagicMock()
        mock_client_instance.post.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        with patch.dict(os.environ, {
            "WHATSAPP_TOKEN": "test_token",
            "WHATSAPP_PHONE_NUMBER_ID": "1234567890"
        }):
            response = client.post("/messages/send", json={
                "to": "9876543210",
                "message": "Test message",
                "message_type": "text"
            })

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["message_id"] == "msg_456"
            assert len(messages_db) == 1

    def test_send_message_not_configured(self):
        """Test sending a message when not configured"""
        with patch.dict(os.environ, {"WHATSAPP_TOKEN": "", "WHATSAPP_PHONE_NUMBER_ID": ""}, clear=True):
            response = client.post("/messages/send", json={
                "to": "9876543210",
                "message": "Test message"
            })
            assert response.status_code == 400
            assert "not configured" in response.json()["detail"]


class TestGetMessages:
    def test_get_all_messages(self):
        """Test getting all messages"""
        # Add some test messages
        messages_db.append(WhatsAppMessage(
            from_number="1111111111",
            to_number="2222222222",
            message="Message 1",
            timestamp="2023-01-01T00:00:00"
        ))
        messages_db.append(WhatsAppMessage(
            from_number="3333333333",
            to_number="4444444444",
            message="Message 2",
            timestamp="2023-01-01T00:01:00"
        ))

        response = client.get("/messages")
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_get_messages_filtered_by_phone(self):
        """Test getting messages filtered by phone number"""
        messages_db.append(WhatsAppMessage(
            from_number="1111111111",
            to_number="2222222222",
            message="Message 1",
            timestamp="2023-01-01T00:00:00"
        ))
        messages_db.append(WhatsAppMessage(
            from_number="3333333333",
            to_number="1111111111",
            message="Message 2",
            timestamp="2023-01-01T00:01:00"
        ))
        messages_db.append(WhatsAppMessage(
            from_number="5555555555",
            to_number="6666666666",
            message="Message 3",
            timestamp="2023-01-01T00:02:00"
        ))

        response = client.get("/messages?phone_number=1111111111")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestGetConversations:
    def test_get_conversations(self):
        """Test getting list of conversations"""
        with patch.dict(os.environ, {"WHATSAPP_PHONE_NUMBER_ID": "1234567890"}):
            # Add messages from different phone numbers
            messages_db.append(WhatsAppMessage(
                from_number="1111111111",
                to_number="1234567890",
                message="Hello",
                timestamp="2023-01-01T00:00:00",
                status="received"
            ))
            messages_db.append(WhatsAppMessage(
                from_number="1234567890",
                to_number="1111111111",
                message="Hi there",
                timestamp="2023-01-01T00:01:00",
                status="sent"
            ))
            messages_db.append(WhatsAppMessage(
                from_number="2222222222",
                to_number="1234567890",
                message="Hey",
                timestamp="2023-01-01T00:02:00",
                status="received"
            ))

            response = client.get("/conversations")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["phone_number"] in ["1111111111", "2222222222"]

    def test_get_conversations_with_unread_count(self):
        """Test conversations include unread count"""
        with patch.dict(os.environ, {"WHATSAPP_PHONE_NUMBER_ID": "1234567890"}):
            # Add received messages (should count as unread)
            messages_db.append(WhatsAppMessage(
                from_number="1111111111",
                to_number="1234567890",
                message="Message 1",
                timestamp="2023-01-01T00:00:00",
                status="received"
            ))
            messages_db.append(WhatsAppMessage(
                from_number="1111111111",
                to_number="1234567890",
                message="Message 2",
                timestamp="2023-01-01T00:01:00",
                status="received"
            ))

            response = client.get("/conversations")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["unread_count"] == 2


class TestClearMessages:
    def test_clear_messages(self):
        """Test clearing all messages"""
        # Add some messages
        messages_db.append(WhatsAppMessage(
            from_number="1111111111",
            to_number="2222222222",
            message="Test",
            timestamp="2023-01-01T00:00:00"
        ))

        response = client.delete("/messages")
        assert response.status_code == 200
        assert len(messages_db) == 0


class TestGetMessage:
    def test_get_message_by_id(self):
        """Test getting a specific message by ID"""
        msg = WhatsAppMessage(
            id="msg_123",
            from_number="1111111111",
            to_number="2222222222",
            message="Test message",
            timestamp="2023-01-01T00:00:00"
        )
        messages_db.append(msg)

        response = client.get("/messages/msg_123")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "msg_123"
        assert data["message"] == "Test message"

    def test_get_message_not_found(self):
        """Test getting a message that doesn't exist"""
        response = client.get("/messages/nonexistent")
        assert response.status_code == 404
