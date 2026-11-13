#!/bin/sh
# One-off: reduce the 346 MB S-Pankki CSV to small per-customer JSON files for the curated demo profiles.
# Usage: sh scripts/reduce.sh /path/to/raw   (folder holding the four official CSVs)
set -e
RAW="${1:-$HOME/Developer/sisu-data/raw}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/data"
IDS="'CUST04974','CUST04414','CUST02003'"
mkdir -p "$OUT/customers"
duckdb -no-agent <<SQL
CREATE TABLE tx AS SELECT * FROM read_csv('$RAW/tx_junction_transactions.csv', header=true, types={'mcc_code':'VARCHAR','merchant_id':'VARCHAR'});
CREATE TABLE cust AS SELECT * FROM read_csv('$RAW/tx_customers_junction.csv', header=true, types={'customer_postal_code':'VARCHAR'});
COPY (SELECT customer_id AS customerId, customer_postal_code AS postalCode, customer_age AS age FROM cust WHERE customer_id IN ($IDS)) TO '$OUT/customers/index.json' (FORMAT json, ARRAY true);
COPY (SELECT customer_id AS customerId, strftime(tx_date,'%Y-%m-%d') AS date, substr(tx_timestamp,9) AS time, category, tx_amount_eur AS amount, balance_after_eur AS balanceAfter, transaction_type AS type, merchant_id AS merchantId, mcc_code AS mcc
      FROM tx WHERE customer_id IN ($IDS) ORDER BY customer_id, tx_date, substr(tx_timestamp,9)) TO '$OUT/customers/transactions.json' (FORMAT json, ARRAY true);
-- Peer benchmark: average monthly spend per category by age band, last 12 months of data.
COPY (
  WITH b AS (SELECT customer_id, CASE WHEN customer_age<25 THEN '18-24' WHEN customer_age<31 THEN '25-30' WHEN customer_age<45 THEN '31-44' ELSE '45+' END AS band FROM cust),
  n AS (SELECT band, count(*) AS customers FROM b GROUP BY 1)
  SELECT b.band AS ageBand, t.category, any_value(n.customers) AS customers, round(sum(-t.tx_amount_eur)/any_value(n.customers)/12, 2) AS avgMonthly
  FROM tx t JOIN b USING(customer_id) JOIN n USING(band)
  WHERE t.tx_date >= DATE '2025-10-01' AND t.tx_amount_eur < 0 AND t.category NOT IN ('Salary Sweep')
  GROUP BY 1,2 ORDER BY 1,2
) TO '$OUT/benchmarks.json' (FORMAT json, ARRAY true);
COPY (SELECT l.* FROM read_csv('$RAW/mtg_tx_customer_link_and_final_mtg_infio.csv', header=true) l WHERE customer_id IN ($IDS)) TO '$OUT/mortgage_final.json' (FORMAT json, ARRAY true);
COPY (SELECT h.* FROM read_csv('$RAW/mtg_negotiation_history.csv', header=true) h WHERE mortgage_customer_id IN (SELECT mortgage_customer_id FROM read_csv('$RAW/mtg_tx_customer_link_and_final_mtg_infio.csv', header=true) WHERE customer_id IN ($IDS)) ORDER BY 2) TO '$OUT/mortgage_events.json' (FORMAT json, ARRAY true);
SQL
ls -la "$OUT" "$OUT/customers"
