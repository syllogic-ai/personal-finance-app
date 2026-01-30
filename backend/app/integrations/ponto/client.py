"""
Ponto Connect API client for OAuth and data fetching.
"""
import base64
import hashlib
import secrets
import logging
from typing import Optional, List, Any
from datetime import datetime
import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class TokenResponse(BaseModel):
    """OAuth token response from Ponto."""
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str
    scope: str


class PontoAccount(BaseModel):
    """Ponto account data model."""
    id: str
    type: str = "account"
    subtype: str
    reference: str
    reference_type: str
    description: str
    currency: str
    available_balance: Optional[float] = None
    current_balance: Optional[float] = None
    holder_name: Optional[str] = None
    institution_id: Optional[str] = None


class PontoTransaction(BaseModel):
    """Ponto transaction data model."""
    id: str
    type: str = "transaction"
    value_date: datetime
    execution_date: datetime
    amount: float
    currency: str
    counterpart_name: Optional[str] = None
    counterpart_reference: Optional[str] = None
    description: str
    remittance_information: Optional[str] = None
    remittance_information_type: Optional[str] = None
    internal_reference: Optional[str] = None
    bank_transaction_code: Optional[str] = None
    proprietary_bank_transaction_code: Optional[str] = None
    end_to_end_id: Optional[str] = None
    purpose_code: Optional[str] = None
    mandate_id: Optional[str] = None
    creditor_id: Optional[str] = None
    fee: Optional[float] = None


class Synchronization(BaseModel):
    """Ponto synchronization status."""
    id: str
    type: str = "synchronization"
    status: str
    subtype: str
    resource_type: str
    resource_id: str
    errors: Optional[List[dict]] = None
    created_at: datetime
    updated_at: datetime


class PontoClient:
    """
    Client for interacting with Ponto Connect API.
    Handles OAuth 2.0 with PKCE and data fetching.

    Ponto requires mTLS (mutual TLS) for API calls. You need to provide
    a client certificate and private key to authenticate.
    """

    BASE_URL = "https://api.ibanity.com/ponto-connect"

    # Authorization URLs (no mTLS required)
    AUTH_URL_SANDBOX = "https://sandbox-authorization.myponto.com/oauth2"
    AUTH_URL_LIVE = "https://authorization.myponto.com/oauth2"

    # Token URLs (mTLS optional for myponto.com endpoints)
    TOKEN_URL_SANDBOX = "https://sandbox-token.myponto.com/oauth2"
    TOKEN_URL_LIVE = "https://token.myponto.com/oauth2"

    # API Token URL (mTLS required for api.ibanity.com)
    API_TOKEN_URL = "https://api.ibanity.com/ponto-connect/oauth2"

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        sandbox: bool = True,
        cert_path: Optional[str] = None,
        key_path: Optional[str] = None,
        key_passphrase: Optional[str] = None,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.sandbox = sandbox
        self.cert_path = cert_path
        self.key_path = key_path
        self.key_passphrase = key_passphrase
        self._http_client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        # Configure mTLS if certificate is provided
        if self.cert_path and self.key_path:
            import ssl
            ssl_context = ssl.create_default_context()
            ssl_context.load_cert_chain(
                certfile=self.cert_path,
                keyfile=self.key_path,
                password=self.key_passphrase,
            )
            self._http_client = httpx.AsyncClient(timeout=30.0, verify=ssl_context)
            logger.info("Ponto client initialized with mTLS")
        else:
            self._http_client = httpx.AsyncClient(timeout=30.0)
            logger.warning("Ponto client initialized without mTLS - API calls may fail")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._http_client:
            await self._http_client.aclose()

    @property
    def http_client(self) -> httpx.AsyncClient:
        if self._http_client is None:
            raise RuntimeError("PontoClient must be used as async context manager")
        return self._http_client

    def _get_auth_header(self) -> str:
        """Generate Basic auth header for client credentials."""
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"

    # =========================================================================
    # PKCE helpers
    # =========================================================================

    @staticmethod
    def generate_code_verifier() -> str:
        """Generate a cryptographically random code verifier for PKCE."""
        return secrets.token_urlsafe(64)

    @staticmethod
    def generate_code_challenge(code_verifier: str) -> str:
        """Generate code challenge from verifier using S256 method."""
        digest = hashlib.sha256(code_verifier.encode()).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()

    @staticmethod
    def generate_state() -> str:
        """Generate a random state parameter for OAuth."""
        return secrets.token_urlsafe(32)

    # =========================================================================
    # OAuth flow
    # =========================================================================

    @property
    def auth_url(self) -> str:
        """Get the authorization URL based on sandbox mode."""
        return self.AUTH_URL_SANDBOX if self.sandbox else self.AUTH_URL_LIVE

    @property
    def token_url(self) -> str:
        """Get the token URL based on sandbox mode."""
        return self.TOKEN_URL_SANDBOX if self.sandbox else self.TOKEN_URL_LIVE

    def get_authorization_url(
        self,
        redirect_uri: str,
        state: str,
        code_challenge: str,
        scope: str = "offline_access ai pi name",
    ) -> str:
        """
        Generate the Ponto authorization URL for user consent.

        Args:
            redirect_uri: URL where Ponto redirects after authorization
            state: Random state to prevent CSRF
            code_challenge: PKCE code challenge (S256)
            scope: OAuth scopes to request

        Returns:
            Authorization URL to redirect user to
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scope,
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        # Note: Ponto uses /auth endpoint, not /authorize
        return f"{self.auth_url}/auth?{query_string}"

    async def exchange_code_for_tokens(
        self,
        code: str,
        code_verifier: str,
        redirect_uri: str,
    ) -> TokenResponse:
        """
        Exchange authorization code for access and refresh tokens.

        Args:
            code: Authorization code from callback
            code_verifier: PKCE code verifier used to generate challenge
            redirect_uri: Same redirect URI used in authorization request

        Returns:
            TokenResponse with access and refresh tokens
        """
        response = await self.http_client.post(
            f"{self.token_url}/token",
            headers={
                "Authorization": self._get_auth_header(),
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "authorization_code",
                "code": code,
                "code_verifier": code_verifier,
                "redirect_uri": redirect_uri,
            },
        )

        response.raise_for_status()
        data = response.json()

        return TokenResponse(**data)

    async def refresh_access_token(self, refresh_token: str) -> TokenResponse:
        """
        Refresh the access token using a refresh token.

        Args:
            refresh_token: Valid refresh token

        Returns:
            TokenResponse with new access and refresh tokens
        """
        response = await self.http_client.post(
            f"{self.token_url}/token",
            headers={
                "Authorization": self._get_auth_header(),
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
        )

        response.raise_for_status()
        data = response.json()

        return TokenResponse(**data)

    async def revoke_token(self, token: str) -> bool:
        """
        Revoke an access or refresh token.

        Args:
            token: Token to revoke

        Returns:
            True if successful
        """
        try:
            response = await self.http_client.post(
                f"{self.token_url}/revoke",
                headers={
                    "Authorization": self._get_auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={"token": token},
            )
            response.raise_for_status()
            return True
        except Exception as e:
            logger.warning(f"Failed to revoke token: {e}")
            return False

    # =========================================================================
    # Data fetching
    # =========================================================================

    async def _api_request(
        self,
        method: str,
        endpoint: str,
        access_token: str,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None,
    ) -> dict:
        """Make an authenticated API request to Ponto."""
        url = f"{self.BASE_URL}{endpoint}"

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.api+json",
        }

        if json_data:
            headers["Content-Type"] = "application/vnd.api+json"

        response = await self.http_client.request(
            method,
            url,
            headers=headers,
            params=params,
            json=json_data,
        )

        response.raise_for_status()
        return response.json()

    async def list_accounts(self, access_token: str) -> List[PontoAccount]:
        """
        List all accounts linked to the Ponto connection.

        Args:
            access_token: Valid access token

        Returns:
            List of PontoAccount objects
        """
        accounts = []
        next_link: Optional[str] = "/accounts"

        while next_link:
            endpoint = next_link if next_link.startswith("/") else next_link.replace(self.BASE_URL, "")
            data = await self._api_request("GET", endpoint, access_token)

            for item in data.get("data", []):
                attrs = item.get("attributes", {})
                account = PontoAccount(
                    id=item["id"],
                    subtype=attrs.get("subtype", ""),
                    reference=attrs.get("reference", ""),
                    reference_type=attrs.get("referenceType", ""),
                    description=attrs.get("description", ""),
                    currency=attrs.get("currency", "EUR"),
                    available_balance=attrs.get("availableBalance"),
                    current_balance=attrs.get("currentBalance"),
                    holder_name=attrs.get("holderName"),
                )
                accounts.append(account)

            links = data.get("links", {})
            next_link = links.get("next")

        return accounts

    async def list_transactions(
        self,
        access_token: str,
        account_id: str,
        since: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[PontoTransaction]:
        """
        List transactions for a specific account.

        Args:
            access_token: Valid access token
            account_id: Ponto account ID
            since: Only fetch transactions after this date
            limit: Maximum transactions per page

        Returns:
            List of PontoTransaction objects
        """
        transactions = []
        next_link: Optional[str] = f"/accounts/{account_id}/transactions"

        params: dict[str, Any] = {"page[limit]": limit}

        while next_link:
            endpoint = next_link if next_link.startswith("/") else next_link.replace(self.BASE_URL, "")

            # Only use params on first request
            request_params = params if endpoint == f"/accounts/{account_id}/transactions" else None

            data = await self._api_request("GET", endpoint, access_token, params=request_params)

            for item in data.get("data", []):
                attrs = item.get("attributes", {})

                value_date = datetime.fromisoformat(attrs["valueDate"].replace("Z", "+00:00"))
                execution_date = datetime.fromisoformat(attrs["executionDate"].replace("Z", "+00:00"))

                # Skip if before since date
                if since and execution_date < since:
                    next_link = None
                    break

                transaction = PontoTransaction(
                    id=item["id"],
                    value_date=value_date,
                    execution_date=execution_date,
                    amount=float(attrs.get("amount", 0)),
                    currency=attrs.get("currency", "EUR"),
                    counterpart_name=attrs.get("counterpartName"),
                    counterpart_reference=attrs.get("counterpartReference"),
                    description=attrs.get("description", ""),
                    remittance_information=attrs.get("remittanceInformation"),
                    remittance_information_type=attrs.get("remittanceInformationType"),
                    internal_reference=attrs.get("internalReference"),
                    bank_transaction_code=attrs.get("bankTransactionCode"),
                    proprietary_bank_transaction_code=attrs.get("proprietaryBankTransactionCode"),
                    end_to_end_id=attrs.get("endToEndId"),
                    purpose_code=attrs.get("purposeCode"),
                    mandate_id=attrs.get("mandateId"),
                    creditor_id=attrs.get("creditorId"),
                    fee=attrs.get("fee"),
                )
                transactions.append(transaction)

            links = data.get("links", {})
            next_link = links.get("next") if next_link else None

        return transactions

    async def create_synchronization(
        self,
        access_token: str,
        account_id: str,
        customer_ip_address: str,
        subtype: str = "accountTransactions",
    ) -> Synchronization:
        """
        Trigger a synchronization for an account (API v2).

        Note: Ponto rate-limits manual syncs to 5 minutes between syncs (v2).
        Maximum 50 synchronizations per day per account.

        Args:
            access_token: Valid access token
            account_id: Ponto account ID
            customer_ip_address: IP address of the customer (required in v2)
            subtype: Type of sync ('accountDetails', 'accountTransactions',
                     or 'accountTransactionsWithUnsettled')

        Returns:
            Synchronization status object
        """
        # V2 API uses /synchronizations endpoint with resourceType/resourceId
        data = await self._api_request(
            "POST",
            "/synchronizations",
            access_token,
            json_data={
                "data": {
                    "type": "synchronization",
                    "attributes": {
                        "resourceType": "account",
                        "resourceId": account_id,
                        "subtype": subtype,
                        "customerIpAddress": customer_ip_address,
                    },
                }
            },
        )

        attrs = data.get("data", {}).get("attributes", {})

        return Synchronization(
            id=data["data"]["id"],
            status=attrs.get("status", "pending"),
            subtype=attrs.get("subtype", subtype),
            resource_type=attrs.get("resourceType", "account"),
            resource_id=attrs.get("resourceId", account_id),
            errors=attrs.get("errors"),
            created_at=datetime.fromisoformat(attrs["createdAt"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat(attrs["updatedAt"].replace("Z", "+00:00")),
        )

    async def get_synchronization(
        self,
        access_token: str,
        synchronization_id: str,
    ) -> Synchronization:
        """
        Get the status of a synchronization.

        Args:
            access_token: Valid access token
            synchronization_id: Synchronization ID

        Returns:
            Synchronization status object
        """
        data = await self._api_request(
            "GET",
            f"/synchronizations/{synchronization_id}",
            access_token,
        )

        attrs = data.get("data", {}).get("attributes", {})

        return Synchronization(
            id=data["data"]["id"],
            status=attrs.get("status", "pending"),
            subtype=attrs.get("subtype", ""),
            resource_type=attrs.get("resourceType", ""),
            resource_id=attrs.get("resourceId", ""),
            errors=attrs.get("errors"),
            created_at=datetime.fromisoformat(attrs["createdAt"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat(attrs["updatedAt"].replace("Z", "+00:00")),
        )

    async def get_user_info(self, access_token: str) -> dict:
        """
        Get user information from Ponto.

        Args:
            access_token: Valid access token

        Returns:
            User info dict with organization details
        """
        data = await self._api_request("GET", "/userinfo", access_token)
        return data
