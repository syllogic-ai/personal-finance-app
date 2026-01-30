"""
Token management service for encrypting/decrypting OAuth tokens
and handling auto-refresh functionality.
"""
import os
import logging
from typing import Optional, Tuple
from datetime import datetime, timedelta, timezone
from cryptography.fernet import Fernet

from sqlalchemy.orm import Session as DBSession
from app.models import BankConnection
from app.integrations.ponto.client import PontoClient, TokenResponse

logger = logging.getLogger(__name__)


class TokenService:
    """
    Service for managing OAuth tokens securely.

    Handles:
    - Encryption/decryption of tokens at rest
    - Auto-refresh of expiring tokens
    - Token storage in database
    """

    # Refresh tokens when within this many minutes of expiry
    REFRESH_THRESHOLD_MINUTES = 5

    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialize token service.

        Args:
            encryption_key: Fernet encryption key (32 url-safe base64-encoded bytes).
                           If not provided, reads from TOKEN_ENCRYPTION_KEY env var.
        """
        key = encryption_key or os.getenv("TOKEN_ENCRYPTION_KEY")
        if not key:
            raise ValueError(
                "TOKEN_ENCRYPTION_KEY must be set in environment or passed to TokenService"
            )

        self._fernet = Fernet(key.encode() if isinstance(key, str) else key)

    def encrypt_token(self, token: str) -> str:
        """
        Encrypt a token for storage.

        Args:
            token: Plain text token

        Returns:
            Encrypted token string
        """
        return self._fernet.encrypt(token.encode()).decode()

    def decrypt_token(self, encrypted_token: str) -> str:
        """
        Decrypt a stored token.

        Args:
            encrypted_token: Encrypted token string

        Returns:
            Plain text token
        """
        return self._fernet.decrypt(encrypted_token.encode()).decode()

    def is_token_expiring(
        self,
        expires_at: Optional[datetime],
        threshold_minutes: Optional[int] = None,
    ) -> bool:
        """
        Check if a token is expiring soon.

        Args:
            expires_at: Token expiry datetime
            threshold_minutes: Minutes before expiry to consider "expiring"

        Returns:
            True if token is expired or expiring soon
        """
        if not expires_at:
            return True

        threshold = threshold_minutes or self.REFRESH_THRESHOLD_MINUTES
        now = datetime.now(timezone.utc)

        # Make expires_at timezone-aware if it isn't
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        return now >= (expires_at - timedelta(minutes=threshold))

    def get_decrypted_tokens(
        self,
        connection: BankConnection,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Get decrypted access and refresh tokens from a bank connection.

        Args:
            connection: BankConnection model instance

        Returns:
            Tuple of (access_token, refresh_token), either can be None
        """
        access_token = None
        refresh_token = None

        if connection.access_token:
            try:
                access_token = self.decrypt_token(connection.access_token)
            except Exception as e:
                logger.error(f"Failed to decrypt access token: {e}")

        if connection.refresh_token:
            try:
                refresh_token = self.decrypt_token(connection.refresh_token)
            except Exception as e:
                logger.error(f"Failed to decrypt refresh token: {e}")

        return access_token, refresh_token

    def store_tokens(
        self,
        db: DBSession,
        connection: BankConnection,
        token_response: TokenResponse,
    ) -> None:
        """
        Store encrypted tokens in a bank connection.

        Args:
            db: Database session
            connection: BankConnection to update
            token_response: TokenResponse from OAuth exchange
        """
        connection.access_token = self.encrypt_token(token_response.access_token)
        connection.refresh_token = self.encrypt_token(token_response.refresh_token)
        connection.access_token_expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=token_response.expires_in
        )

        db.add(connection)
        db.commit()

        logger.info(f"Stored tokens for connection {connection.id}")

    async def get_valid_access_token(
        self,
        db: DBSession,
        connection: BankConnection,
        ponto_client: PontoClient,
    ) -> Optional[str]:
        """
        Get a valid access token, refreshing if necessary.

        Args:
            db: Database session
            connection: BankConnection with tokens
            ponto_client: PontoClient for refreshing

        Returns:
            Valid access token, or None if refresh failed
        """
        access_token, refresh_token = self.get_decrypted_tokens(connection)

        if not access_token or not refresh_token:
            logger.error(f"No tokens found for connection {connection.id}")
            return None

        # Check if token needs refresh
        if self.is_token_expiring(connection.access_token_expires_at):
            logger.info(f"Access token expiring, refreshing for connection {connection.id}")

            try:
                token_response = await ponto_client.refresh_access_token(refresh_token)
                self.store_tokens(db, connection, token_response)
                access_token = token_response.access_token
                logger.info(f"Successfully refreshed token for connection {connection.id}")
            except Exception as e:
                logger.error(f"Failed to refresh token for connection {connection.id}: {e}")
                connection.status = "error"
                connection.error_message = f"Token refresh failed: {str(e)}"
                db.commit()
                return None

        return access_token

    @staticmethod
    def generate_encryption_key() -> str:
        """
        Generate a new Fernet encryption key.

        Returns:
            URL-safe base64-encoded 32-byte key
        """
        return Fernet.generate_key().decode()


def get_token_service() -> TokenService:
    """
    Factory function to get a TokenService instance.

    Returns:
        TokenService instance
    """
    return TokenService()
