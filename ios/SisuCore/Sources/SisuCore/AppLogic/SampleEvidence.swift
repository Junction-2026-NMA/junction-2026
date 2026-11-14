// Offline only: the bundled sample has one transactions file per basket plus the newest 300 rows overall, and
// FixtureAPI does not filter rows. So that a figure still opens exactly its own rows in sample mode, the app
// asks for the right basket file and narrows it here. Online, the server filters and this is not used.
import Foundation

public enum SampleEvidence {
    /// The basket whose bundled file holds the rows for `filter`: its own basket, or the basket of its
    /// category in the overview. Nil when neither is known (the overall file is then the source).
    public static func basket(for filter: EvidenceFilter, in overview: Overview) -> BasketId? {
        if let basket = filter.basket { return basket }
        guard let category = filter.category else { return nil }
        return overview.baskets.first { $0.categories.contains { $0.category == category } }?.id
    }

    /// The rows of `list` that match `filter`: dates within `from`...`to` (inclusive, ISO dates), the category,
    /// the merchant category code, and a balance below zero after the payment when `negativeBalance` is true.
    /// `count` and `total` are recomputed from the rows kept; `truncated` stays as it was, because rows missing
    /// from a truncated source cannot be found.
    public static func narrow(_ list: TransactionList, to filter: EvidenceFilter?) -> TransactionList {
        guard let filter else { return list }
        let rows = list.transactions.filter { row in
            let day = String(row.date.prefix(10))
            if !filter.from.isEmpty, day < filter.from { return false }
            if !filter.to.isEmpty, day > filter.to { return false }
            if let category = filter.category, row.category != category { return false }
            if let mcc = filter.mcc, row.mcc != mcc { return false }
            if filter.negativeBalance == true, row.balanceAfter >= 0 { return false }
            return true
        }
        let total = (rows.reduce(0) { $0 + $1.amount } * 100).rounded() / 100
        return TransactionList(customerId: list.customerId, dataTimestamp: list.dataTimestamp, currency: list.currency,
                               count: rows.count, total: total, truncated: list.truncated, transactions: rows)
    }
}
