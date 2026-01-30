"""
Celery tasks for syncing Ponto bank connections.
"""
import os
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List

from celery_app import celery_app
from app.database import SessionLocal
from app.models import BankConnection, Account
from app.integrations.ponto.client import PontoClient
from app.integrations.ponto.adapter import PontoAdapter
from app.services.token_service import TokenService
from app.services.sync_service import SyncService

logger = logging.getLogger(__name__)


def get_ponto_client() -> PontoClient:
    """Get configured Ponto client."""
    client_id = os.getenv("PONTO_CLIENT_ID")
    client_secret = os.getenv("PONTO_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise ValueError("PONTO_CLIENT_ID and PONTO_CLIENT_SECRET must be set")

    return PontoClient(client_id, client_secret)


async def _sync_connection(connection_id: str) -> dict:
    """
    Async helper to sync a single Ponto connection.

    Args:
        connection_id: UUID of the bank connection

    Returns:
        Dict with sync results
    """
    db = SessionLocal()

    try:
        connection = db.query(BankConnection).filter(
            BankConnection.id == connection_id,
            BankConnection.provider == "ponto",
            BankConnection.status == "linked",
        ).first()

        if not connection:
            return {"error": f"Connection {connection_id} not found or not active"}

        # Update sync status
        connection.sync_status = "syncing"
        db.commit()

        client = get_ponto_client()
        token_service = TokenService()

        async with client:
            # Get valid access token
            access_token = await token_service.get_valid_access_token(
                db, connection, client
            )

            if not access_token:
                connection.sync_status = "error"
                connection.error_message = "Failed to get valid access token"
                db.commit()
                return {"error": "Failed to get valid access token"}

            # Get accounts
            accounts = db.query(Account).filter(
                Account.bank_connection_id == connection.id
            ).all()

            adapter = PontoAdapter(
                access_token=access_token,
                refresh_token=token_service.decrypt_token(connection.refresh_token),
                client=client,
            )

            sync_service = SyncService(db, user_id=connection.user_id)
            total_created = 0
            total_updated = 0

            for account in accounts:
                if not account.external_id:
                    continue

                try:
                    # Fetch transactions since last sync
                    start_date = account.last_synced_at
                    transactions = await adapter.fetch_transactions(
                        account.external_id,
                        start_date=start_date,
                    )

                    # Import transactions
                    for tx_data in transactions:
                        result = sync_service.upsert_transaction(
                            account_id=str(account.id),
                            transaction_data=tx_data,
                        )
                        if result.get("created"):
                            total_created += 1
                        elif result.get("updated"):
                            total_updated += 1

                    # Update account last synced
                    account.last_synced_at = datetime.now(timezone.utc)

                except Exception as e:
                    logger.error(f"Failed to sync account {account.id}: {e}")

            # Update connection
            connection.last_synced_at = datetime.now(timezone.utc)
            connection.sync_status = "idle"
            connection.error_message = None
            db.commit()

            return {
                "connection_id": str(connection_id),
                "accounts_synced": len(accounts),
                "transactions_created": total_created,
                "transactions_updated": total_updated,
            }

    except Exception as e:
        logger.error(f"Sync failed for connection {connection_id}: {e}")

        # Update error status
        try:
            connection = db.query(BankConnection).get(connection_id)
            if connection:
                connection.sync_status = "error"
                connection.error_message = str(e)
                db.commit()
        except Exception:
            pass

        return {"error": str(e)}

    finally:
        db.close()


async def _refresh_tokens_for_connection(connection_id: str) -> dict:
    """
    Async helper to refresh tokens for a connection.

    Args:
        connection_id: UUID of the bank connection

    Returns:
        Dict with refresh result
    """
    db = SessionLocal()

    try:
        connection = db.query(BankConnection).filter(
            BankConnection.id == connection_id,
            BankConnection.provider == "ponto",
            BankConnection.status == "linked",
        ).first()

        if not connection:
            return {"error": f"Connection {connection_id} not found"}

        client = get_ponto_client()
        token_service = TokenService()

        async with client:
            access_token = await token_service.get_valid_access_token(
                db, connection, client
            )

            if access_token:
                return {
                    "connection_id": str(connection_id),
                    "refreshed": True,
                }
            else:
                return {
                    "connection_id": str(connection_id),
                    "error": "Failed to refresh token",
                }

    except Exception as e:
        logger.error(f"Token refresh failed for connection {connection_id}: {e}")
        return {"error": str(e)}

    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def sync_all_ponto_connections(self):
    """
    Sync transactions for all active Ponto connections.

    This task runs daily at 6:00 AM UTC.
    """
    logger.info("Starting sync_all_ponto_connections task")

    db = SessionLocal()

    try:
        # Get all active Ponto connections
        connections = db.query(BankConnection).filter(
            BankConnection.provider == "ponto",
            BankConnection.status == "linked",
        ).all()

        logger.info(f"Found {len(connections)} active Ponto connections to sync")

        results = []
        for connection in connections:
            try:
                result = asyncio.run(_sync_connection(str(connection.id)))
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to sync connection {connection.id}: {e}")
                results.append({
                    "connection_id": str(connection.id),
                    "error": str(e),
                })

        logger.info(f"Completed sync_all_ponto_connections: {len(results)} connections processed")
        return {
            "connections_processed": len(results),
            "results": results,
        }

    except Exception as e:
        logger.error(f"sync_all_ponto_connections task failed: {e}")
        raise self.retry(exc=e, countdown=60)

    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def refresh_expiring_tokens(self):
    """
    Refresh tokens that are expiring within 30 minutes.

    This task runs every 15 minutes.
    """
    logger.info("Starting refresh_expiring_tokens task")

    db = SessionLocal()

    try:
        # Find connections with tokens expiring in the next 30 minutes
        threshold = datetime.now(timezone.utc) + timedelta(minutes=30)

        connections = db.query(BankConnection).filter(
            BankConnection.provider == "ponto",
            BankConnection.status == "linked",
            BankConnection.access_token_expires_at < threshold,
            BankConnection.refresh_token.isnot(None),
        ).all()

        logger.info(f"Found {len(connections)} connections with expiring tokens")

        results = []
        for connection in connections:
            try:
                result = asyncio.run(_refresh_tokens_for_connection(str(connection.id)))
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to refresh token for connection {connection.id}: {e}")
                results.append({
                    "connection_id": str(connection.id),
                    "error": str(e),
                })

        logger.info(f"Completed refresh_expiring_tokens: {len(results)} tokens processed")
        return {
            "tokens_processed": len(results),
            "results": results,
        }

    except Exception as e:
        logger.error(f"refresh_expiring_tokens task failed: {e}")
        raise self.retry(exc=e, countdown=60)

    finally:
        db.close()


@celery_app.task
def sync_single_connection(connection_id: str):
    """
    Sync a single Ponto connection.

    Can be called manually or queued after initial connection.

    Args:
        connection_id: UUID of the bank connection to sync
    """
    logger.info(f"Starting sync for connection {connection_id}")

    try:
        result = asyncio.run(_sync_connection(connection_id))
        logger.info(f"Completed sync for connection {connection_id}: {result}")
        return result

    except Exception as e:
        logger.error(f"Sync failed for connection {connection_id}: {e}")
        return {"error": str(e)}
