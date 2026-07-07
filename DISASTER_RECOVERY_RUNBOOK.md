# 🛡️ VeggiePOS Database Disaster Recovery Runbook & Supabase Backup Strategy

This runbook documents the disaster recovery procedures, database backup infrastructure, and step-by-step restoration protocols for **VeggiePOS**. 

---

## 📊 Recovery Objectives & Service Level Agreements (SLAs)

If database corruption, accidental query updates, or system disasters occur, the system relies on two key metric targets:

| Metric | Target SLA | Explanation / Mechanism |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **< 1 Minute** | With **Point-in-Time Recovery (PITR)** active, Supabase continuously archives write-ahead logs (WAL) to S3, allowing restoration to any microsecond. |
| **RTO (Recovery Time Objective)** | **< 15 Minutes** | Time required to initiate, process, and verify a complete server-side snapshot restoration or point-in-time rollback. |

---

## 🛠️ Step 1: Enable Point-in-Time Recovery (PITR) in Supabase

PITR must be activated via the Supabase admin panel to guarantee continuous real-time WAL logging:

1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your **VeggiePOS** project.
3. In the sidebar, navigate to **Settings ⚙️** -> **Database**.
4. Scroll down to the **Backups** section.
5. Click **Enable Point-in-Time Recovery (PITR)**.
6. Choose a retention period (recommended: **7 days** or **30 days** depending on compliance requirements).
7. Save configuration. 
   > *Note: PITR utilizes physical backups streaming continuously. If you are on a Free/Pro plan, make sure PITR add-on is subscribed.*

---

## 🚨 Disaster Recovery Execution Steps (अगर DB corrupt ho jaye to kya karein?)

When database corruption is identified, execute the following steps sequentially to prevent split-brain states and fully restore the database.

### 1. Alert Team & Suspend Ingress (Traffic Pause)
To avoid corrupted writes or further data drift during restoration, put the application in temporary maintenance mode.
* Set the environment variable `MAINTENANCE_MODE=true` in Cloud Run settings.
* This will display a clean "System Under Scheduled Maintenance" page to incoming terminal operators.

### 2. Identify the Target Recovery Timestamp (Sankat Ka Samay)
Locate the exact timestamp immediately before the corruption occurred:
* Open the **Application Monitoring Dashboard** -> Central Telemetry.
* Check the exact time of the malicious script execution, SQL error, or bad migration.
* Format the timestamp in UTC ISO-8601: e.g., `2026-07-04T10:15:00Z`.

---

### 3. Restore Database State

#### Method A: Graphical Restore via Supabase Dashboard (Recommended & Safest)
1. Go to the **Supabase Console** -> **Database Settings** -> **Backups**.
2. Click **Point in Time Restore**.
3. Under **Target Timestamp**, enter your calculated safe timestamp (e.g., `2026-07-04 10:14:55`).
4. Click **Initiate Restore**.
5. *Wait ~8-12 minutes.* Supabase will provision a parallel safe cluster, load physical WAL files, replay transactions, and hot-swap your database connection.

#### Method B: Restore via Supabase CLI (For Operations / DevOps Engineers)
If you prefer terminal-based deployment or have self-hosted setups:
```bash
# 1. Login to your Supabase account
supabase login

# 2. Link your current directory to the project ID
supabase link --project-ref "bpswhanfafmz2n4uhirm2r"

# 3. Perform a Point-in-Time rollback using the Link CLI
supabase db restore --project-ref "bpswhanfafmz2n4uhirm2r" --timestamp "2026-07-04T10:14:55Z"
```

#### Method C: Manual Restoration from Automated Daily Snapshots (Emergency Backup Plan)
If Supabase cloud servers are entirely down or a regional GCP blackout occurs, use the daily JSON snapshots compiled automatically by the **Automated Backup Sync Job**:
1. Open the VeggiePOS Admin panel -> **Database Backups Manager**.
2. Click **Download Snapshot** on the latest healthy pre-disaster snapshot.
3. Extract the clean table data.
4. Run the recovery restoration utility to push seed slices back to the Supabase Postgres instance:
   ```bash
   # Execute postgres bulk restore command
   psql -h db.bpswhanfafmz2n4uhirm2r.supabase.co -U postgres -d postgres -f veggiepos_emergency_snapshot.sql
   ```

---

### 4. Post-Restoration Verifications (Sanity Checks)
Once Supabase reports recovery completion:
1. **Flush Redis Cache**:
   * Navigate to the **Application Monitoring Dashboard**.
   * Under the **Distributed Redis Caching Layer** panel, click **Flush Cache** (alternatively run `redis-cli FLUSHDB`). This forces the server to evict any cached stale or corrupted records and retrieve fresh, restored PostgreSQL data.
2. **Perform Data Spot Checks**:
   * Verify that Menu Items load correctly.
   * Cross-reference current restaurant inventory with recent purchase invoices.
3. **Disable Maintenance Mode**:
   * Change `MAINTENANCE_MODE=false` in environment configurations.
   * Allow POS terminals to resume taking customer orders.
