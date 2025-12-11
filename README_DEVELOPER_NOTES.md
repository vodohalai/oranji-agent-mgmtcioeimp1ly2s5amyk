# Oranji Agent - Developer Notes
This document contains important information for developers working on the Oranji Agent project, especially regarding environment variables and database schemas required for Phases 2 and 3.
## Environment Variables
The following environment variables must be configured in `wrangler.jsonc` or as secrets in the Cloudflare dashboard for full functionality.
### Phase 2: Persistence & Tools (D1 + R2)
- **D1 Database Bindings**:
  - The application expects D1 database bindings to be configured for storing chat logs and product information.
  - Add the following to your `wrangler.jsonc`:
    ```json
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "oranji-db",
        "database_id": "your-d1-database-id"
      }
    ]
    ```
  - Make sure to replace `your-d1-database-id` with your actual D1 database ID. The binding name `DB` is used in the worker code.
- **R2 Bucket Binding**:
  - An R2 bucket is required for storing and retrieving documents.
  - Add the following to your `wrangler.jsonc`:
    ```json
    "r2_buckets": [
      {
        "binding": "R2_DOCS",
        "bucket_name": "oranji-docs"
      }
    ]
    ```
  - The binding name `R2_DOCS` is used in the worker code.
### Phase 3: Messenger Integration
- **Facebook Page Token**:
  - `FB_PAGE_TOKEN`: A Page Access Token for your Facebook Page. This is required to send messages via the Messenger Platform API.
  - This should be added as a secret: `wrangler secret put FB_PAGE_TOKEN`
- **Facebook Verify Token**:
  - `FB_VERIFY_TOKEN`: A secret string you create. This is used to verify the webhook endpoint with Facebook.
  - This should be added as a secret: `wrangler secret put FB_VERIFY_TOKEN`
## D1 Database Schemas
The application relies on two primary tables in the D1 database. You can create them using `wrangler d1 execute`.
### 1. `chatlog` Table
Stores the history of conversations. To keep costs and latency low, only the 20 most recent messages per sender/session are stored.
**Schema:**
```sql
CREATE TABLE chatlog (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    sender_id TEXT, -- For Messenger integration
    role TEXT NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    tool_calls TEXT -- JSON string of tool calls
);
CREATE INDEX idx_session_id_timestamp ON chatlog (session_id, timestamp DESC);
CREATE INDEX idx_sender_id_timestamp ON chatlog (sender_id, timestamp DESC);
```
### 2. `products_info` Table
Stores information about products that the AI can query.
**Schema:**
```sql
CREATE TABLE products_info (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL,
    stock_quantity INTEGER,
    category TEXT,
    metadata TEXT -- JSON for additional attributes
);
CREATE INDEX idx_product_name ON products_info (name);
CREATE INDEX idx_product_category ON products_info (category);