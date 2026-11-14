/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/AppLogic/SampleEvidence.swift. Offline only: the bundled sample has one transactions file per
// basket plus the newest 300 rows overall, and the fixture API does not filter rows. So that a figure still opens
// exactly its own rows in sample mode, the app asks for the right basket file and narrows it here. Online, the
// server filters and this is not used.
import type { BasketId, EvidenceFilter, Overview, TransactionList } from "@/web/core/Models";
import { roundAway } from "@/web/core/Presentation";

export namespace SampleEvidence {
  /** The basket whose bundled file holds the rows for `filter`: its own basket, or the basket of its category. */
  export function basket(filter: EvidenceFilter, overview: Overview): BasketId | null {
    if (filter.basket != null) return filter.basket;
    const category = filter.category;
    if (category == null) return null;
    return overview.baskets.find((b) => b.categories.some((c) => c.category === category))?.id ?? null;
  }

  /**
   * The rows of `list` that match `filter`: dates within `from`...`to` (inclusive, ISO dates), the category, the
   * merchant category code, and a balance below zero after the payment when `negativeBalance` is true. `count` and
   * `total` are recomputed from the rows kept; `truncated` stays as it was.
   */
  export function narrow(list: TransactionList, filter: EvidenceFilter | null | undefined): TransactionList {
    if (filter == null) return list;
    const rows = list.transactions.filter((row) => {
      const day = row.date.slice(0, 10);
      if (filter.from !== "" && day < filter.from) return false;
      if (filter.to !== "" && day > filter.to) return false;
      if (filter.category != null && row.category !== filter.category) return false;
      if (filter.mcc != null && row.mcc !== filter.mcc) return false;
      if (filter.negativeBalance === true && row.balanceAfter >= 0) return false;
      return true;
    });
    const total = roundAway(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
    return { ...list, count: rows.length, total, truncated: list.truncated, transactions: rows };
  }
}
