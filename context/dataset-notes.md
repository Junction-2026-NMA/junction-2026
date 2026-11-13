# S-Pankki dataset: what we found

Source: https://github.com/hackjunction/Junction-2026-S-pankki. The data was profiled with DuckDB on Fri 13 Nov.

## Shape

- `tx_junction_transactions.csv`: 3,626,755 rows, 5,100 customers, one account each, from **2024-10-01 to 2026-09-30**. **Comma**-separated with a UTF-8 BOM (the spec says semicolons; it is wrong).
- `tx_customers_junction.csv`: customer ID, postal code (keep it as text) and age. 419 customers are aged 18–24 and 362 are aged 25–30.
- Mortgage files: 200 applications; the event types include `loan_decision`, `collateral_valuation` and `expense_recorded`.
- The raw CSVs are **not** in git. `scripts/reduce.sh /path/to/csv-folder` rebuilds `data/` with DuckDB.

## Things that shaped the design

- **No merchant or payee names exist.** Card purchases have only synthetic IDs (`MRC-RES-0082`) and MCC codes. Bills have no merchant at all.
- **There is no telecom MCC.** The spec's "telecom bill" hero cannot be detected. Instead, `Utilities` arrives as **three payments a month** for almost every customer. Sisu splits them by size into three slots, guesses a name for each (Electricity, Home internet, Mobile plan) and asks the user to confirm.
- The amounts vary month to month (for Aino, roughly €20–65), so they look usage-based. Electricity is therefore the most honest hero bill.
- Categories map to the three S-Pankki baskets in `lib/finance/baskets.ts`:
  - **Housing and Utilities** go to *must pay, every month*.
  - **Health and Home & Tech** go to *must pay, now and then*.
  - **Everything else** goes to *everyday choices*.
  - Investment deposits count as saving. Salary and Other Income count as income.
- Many young customers dip below zero: 611 of the 781 aged 30 or under have at least one negative balance.

## The demo customers

| Name (invented) | ID | Age | Why we picked them |
|---|---|---|---|
| Aino | CUST04974 | 23 | Tight budget, €64/month above her age group on restaurants, below zero in 6 of 12 months |
| Eetu | CUST04414 | 25 | Higher income, already invests, €495/month above his age group on entertainment |
| Sanna | CUST02003 | 33 | Saver with an approved mortgage application (for the mortgage stretch) |

Peer averages come from every customer in the same age band over the last 12 months (`data/benchmarks.json`).
