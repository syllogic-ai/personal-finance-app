# Revolut Integration Guide

This guide explains how to connect your personal Revolut account to import real transactions.

## Overview

The application supports importing Revolut transactions via CSV file export. This is the most practical method for personal Revolut accounts since direct API access requires regulatory approval.

## How to Import Revolut Transactions

### Step 1: Export Transactions from Revolut

1. **Via Revolut App:**
   - Open the Revolut app on your phone
   - Go to your account
   - Navigate to Transactions or Statements
   - Look for an "Export" or "Download" option
   - Select CSV format
   - Choose the date range you want to export

2. **Via Revolut Web Interface:**
   - Log in to https://app.revolut.com
   - Go to your account
   - Navigate to Transactions
   - Look for export/download options
   - Select CSV format and date range

### Step 2: Import CSV File

1. Open the Settings page in the application
2. Scroll to the "Import Revolut Transactions" section
3. Drag and drop your CSV file or click "browse to select"
4. Click "Import Transactions"
5. Wait for the import to complete

### Step 3: Verify Import

- Go to the Transactions page to see your imported transactions
- Check the Settings page to see your Revolut account(s)
- Transactions will be automatically matched to existing accounts or new accounts will be created

## Features

- **Automatic Account Creation:** Accounts are automatically created from the CSV data
- **Deduplication:** Existing transactions are updated instead of duplicated
- **Date Filtering:** You can optionally filter by date range during import
- **Transaction Parsing:** The system intelligently parses various Revolut CSV formats

## CSV Format Support

The adapter supports multiple Revolut CSV formats, including:
- Standard Revolut export format
- Various date formats (YYYY-MM-DD, DD/MM/YYYY, etc.)
- Different field name variations

## Database Schema Changes

The Account model has been updated to include:
- `provider`: The bank provider (e.g., 'revolut', 'plaid', 'manual')
- `external_id`: The provider's account identifier
- `balance_available`: Available balance (in addition to current balance)

**Note:** You may need to run a database migration if you have existing data. The application will attempt to create these columns automatically, but for production databases, you should use Alembic migrations.

## Future Enhancements

The integration is built with an adapter pattern, making it easy to add:
- Direct API integration (when available)
- Other bank providers (Plaid, TrueLayer, etc.)
- Automated scheduled syncs
- Webhook support for real-time updates

## Troubleshooting

### Import Fails
- Ensure the file is a valid CSV file
- Check that the CSV contains transaction data
- Verify the file encoding is UTF-8

### Transactions Not Appearing
- Check the date range in your CSV export
- Verify transactions are not being filtered out
- Check the browser console for error messages

### Account Not Created
- The adapter creates accounts based on CSV data
- If no account appears, the CSV may not contain account information
- You can manually create accounts in the Settings page

## API Endpoint

The sync endpoint is available at:
```
POST /api/sync/revolut/csv
```

Parameters:
- `file`: CSV file (multipart/form-data)
- `start_date`: Optional start date filter (ISO format)
- `end_date`: Optional end date filter (ISO format)

Response:
```json
{
  "accounts_synced": 1,
  "transactions_created": 150,
  "transactions_updated": 0,
  "message": "Successfully synced..."
}
```

