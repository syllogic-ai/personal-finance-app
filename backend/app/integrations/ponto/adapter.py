"""
Ponto adapter implementing the BankAdapter interface.
"""
import logging
from typing import List, Optional
from decimal import Decimal
from datetime import datetime

from app.integrations.base import BankAdapter, AccountData, TransactionData
from app.integrations.ponto.client import PontoClient, PontoAccount, PontoTransaction

logger = logging.getLogger(__name__)


class PontoAdapter(BankAdapter):
    """
    Adapter for Ponto Connect bank integration.
    Implements the BankAdapter interface to normalize Ponto data.
    """

    ACCOUNT_TYPE_MAPPING = {
        "checking": "checking",
        "savings": "savings",
        "current": "checking",
        "deposit": "savings",
        "credit": "credit",
        "creditCard": "credit",
        "loan": "loan",
        "investment": "investment",
    }

    def __init__(
        self,
        access_token: str,
        refresh_token: str,
        client: PontoClient,
        institution_name: str = "Bank via Ponto",
    ):
        """
        Initialize Ponto adapter.

        Args:
            access_token: Valid Ponto access token
            refresh_token: Ponto refresh token
            client: PontoClient instance
            institution_name: Display name for the institution
        """
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.client = client
        self.institution_name = institution_name
        self._accounts_cache: Optional[List[PontoAccount]] = None

    async def fetch_accounts(self) -> List[AccountData]:
        """
        Fetch all accounts from Ponto and normalize to AccountData.

        Returns:
            List of normalized AccountData objects
        """
        ponto_accounts = await self.client.list_accounts(self.access_token)
        self._accounts_cache = ponto_accounts

        accounts = []
        for ponto_account in ponto_accounts:
            account = self._normalize_account(ponto_account)
            accounts.append(account)

        logger.info(f"Fetched {len(accounts)} accounts from Ponto")
        return accounts

    async def fetch_transactions(
        self,
        account_external_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[TransactionData]:
        """
        Fetch transactions for a specific account.

        Args:
            account_external_id: Ponto account ID
            start_date: Fetch transactions after this date
            end_date: Fetch transactions before this date (not used by Ponto)

        Returns:
            List of normalized TransactionData objects
        """
        ponto_transactions = await self.client.list_transactions(
            self.access_token,
            account_external_id,
            since=start_date,
        )

        transactions = []
        for ponto_tx in ponto_transactions:
            # Skip if after end_date
            if end_date and ponto_tx.execution_date > end_date:
                continue

            transaction = self.normalize_transaction(ponto_tx.__dict__)
            transaction.account_external_id = account_external_id
            transactions.append(transaction)

        logger.info(
            f"Fetched {len(transactions)} transactions for account {account_external_id}"
        )
        return transactions

    def normalize_transaction(self, raw: dict) -> TransactionData:
        """
        Convert Ponto transaction format to canonical TransactionData.

        Args:
            raw: Raw Ponto transaction dict

        Returns:
            Normalized TransactionData object
        """
        amount = Decimal(str(raw.get("amount", 0)))

        # Determine transaction type based on amount sign
        if amount >= 0:
            transaction_type = "credit"
        else:
            transaction_type = "debit"

        # Build description from available fields
        description_parts = []
        if raw.get("description"):
            description_parts.append(raw["description"])
        if raw.get("remittance_information"):
            description_parts.append(raw["remittance_information"])

        description = " - ".join(description_parts) if description_parts else "Transaction"

        # Determine merchant/counterpart
        merchant = raw.get("counterpart_name")

        # Parse execution date
        execution_date = raw.get("execution_date")
        if isinstance(execution_date, str):
            execution_date = datetime.fromisoformat(execution_date.replace("Z", "+00:00"))

        return TransactionData(
            external_id=raw["id"],
            account_external_id=raw.get("account_external_id", ""),
            amount=abs(amount),
            currency=raw.get("currency", "EUR"),
            description=description,
            merchant=merchant,
            booked_at=execution_date,
            transaction_type=transaction_type,
            pending=False,  # Ponto only returns booked transactions
            metadata={
                "ponto_id": raw["id"],
                "value_date": str(raw.get("value_date", "")),
                "counterpart_reference": raw.get("counterpart_reference"),
                "bank_transaction_code": raw.get("bank_transaction_code"),
                "end_to_end_id": raw.get("end_to_end_id"),
                "creditor_id": raw.get("creditor_id"),
                "mandate_id": raw.get("mandate_id"),
            },
        )

    def _normalize_account(self, ponto_account: PontoAccount) -> AccountData:
        """
        Convert Ponto account to canonical AccountData.

        Args:
            ponto_account: PontoAccount object

        Returns:
            Normalized AccountData object
        """
        # Map Ponto account subtype to our account types
        account_type = self.ACCOUNT_TYPE_MAPPING.get(
            ponto_account.subtype.lower(), "checking"
        )

        # Use current balance if available, otherwise available balance
        balance = None
        if ponto_account.current_balance is not None:
            balance = Decimal(str(ponto_account.current_balance))
        elif ponto_account.available_balance is not None:
            balance = Decimal(str(ponto_account.available_balance))

        # Build account name
        name = ponto_account.description or ponto_account.reference
        if ponto_account.holder_name:
            name = f"{ponto_account.holder_name} - {name}"

        return AccountData(
            external_id=ponto_account.id,
            name=name,
            account_type=account_type,
            institution=self.institution_name,
            currency=ponto_account.currency,
            balance_available=balance,
            metadata={
                "ponto_id": ponto_account.id,
                "reference": ponto_account.reference,
                "reference_type": ponto_account.reference_type,
                "subtype": ponto_account.subtype,
                "holder_name": ponto_account.holder_name,
            },
        )

    async def trigger_sync(
        self,
        account_external_id: str,
        customer_ip_address: str,
    ) -> dict:
        """
        Trigger a manual synchronization for an account (API v2).

        Note: Ponto rate-limits manual syncs to 5 minutes between syncs.
        Maximum 50 synchronizations per day per account.

        Args:
            account_external_id: Ponto account ID
            customer_ip_address: IP address of the customer (required in v2)

        Returns:
            Synchronization status dict
        """
        sync = await self.client.create_synchronization(
            self.access_token,
            account_external_id,
            customer_ip_address=customer_ip_address,
        )

        return {
            "id": sync.id,
            "status": sync.status,
            "subtype": sync.subtype,
            "created_at": sync.created_at.isoformat(),
        }
