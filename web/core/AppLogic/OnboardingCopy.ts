/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/AppLogic/OnboardingCopy.swift. The words and figures of the first run: each screen's copy, what
// makes each demo profile interesting, the reading moment, and the first insight Today highlights. Every figure
// comes from the overview payload.
import type { DemoCustomer, EvidenceFilter, Overview } from "@/web/core/Models";
import { Money } from "@/web/core/Presentation";
import type { BasketKind } from "@/web/core/Presentation";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";

/** One row of the "what Sisu does" screen: a basket and everyday examples of what lands in it. No amounts. */
export interface OnboardingBasketRow {
  readonly id: string;
  readonly kind: BasketKind;
  /** "Rent, phone, electricity" */
  readonly examples: string;
  /** "Bills that come every month" */
  readonly meaning: string;
}

const basketRow = (kind: BasketKind, examples: string, meaning: string): OnboardingBasketRow => ({ id: kind, kind, examples, meaning });

/** The copy of the intro screens and the profile screen. */
export namespace OnboardingCopy {
  export const welcomeTitle = "See where your money goes, and keep a little more of it.";
  export const welcomeBody = "Sisu is a money coach inside S-Pankki. Small wins with your money, every day.";
  export const welcomeButton = "Show me how";

  export const promiseTitle = "Every euro lands in one of three baskets";
  export const promiseBaskets: readonly OnboardingBasketRow[] = [
    basketRow("fixed", "Rent, phone, electricity", "Bills that come every month"),
    basketRow("curveballs", "Dentist, repairs, gifts", "Needed now and then"),
    basketRow("leaks", "Groceries, coffee, rides", "Day-to-day spending you can adjust"),
  ];
  /** What Sisu does with the baskets: the three promises, one line each. */
  export const promiseThenTitle = "Then Sisu";
  export const promiseThen: readonly string[] = [
    "Shows what is left before payday",
    "Checks live offers for your bills",
    "Suggests one next step at a time",
  ];
  export const promiseButton = "Got it";

  export const profileTitle = "Pick someone to be today";
  export const profileBody = "Sisu reads their last 12 months and shows you what it finds.";
  /** The demo disclosure. The profile screen carries it for the whole demo. */
  export const disclosureTitle = "This is a demo";
  export const disclosureBody = "These are fictional people with synthetic S-⁠Pankki data and invented names. Nothing here is anyone's real money.";

  export const skip = "Skip";
  export const back = "Back";
}

/** What makes each demo profile worth picking. No figures: the profile's overview is not loaded yet. */
export namespace OnboardingProfiles {
  /** The order the profiles are offered in: the strongest story first. */
  export const order: readonly string[] = ["CUST04414", "CUST04974", "CUST02003"];

  /** One line on what is interesting about this profile; a neutral line for a customer Sisu does not know. */
  export function pitch(customerId: string): string {
    switch (customerId) {
      case "CUST04414": return "The biggest bill-switching win";
      case "CUST04974": return "Some months run out before payday";
      case "CUST02003": return "A big buffer, and what to do next";
      default: return "A year of everyday banking";
    }
  }

  /** The customers in `order`, then any others in the order given. */
  export function sorted(customers: readonly DemoCustomer[]): DemoCustomer[] {
    const rank = (customer: DemoCustomer, offset: number) => {
      const index = order.indexOf(customer.customerId);
      return index >= 0 ? index : order.length + offset;
    };
    return customers.map((customer, offset) => ({ customer, key: rank(customer, offset) }))
      .sort((a, b) => a.key - b.key)
      .map((entry) => entry.customer);
  }

  /** "25 · Espoo". */
  export function subtitle(customer: DemoCustomer): string { return `${customer.age} · ${customer.area}`; }

  /** The card's accessibility label: "Eetu, 25, Espoo. The biggest bill-switching win". */
  export function accessibilityLabel(customer: DemoCustomer): string {
    return `${customer.displayName}, ${customer.age}, ${customer.area}. ${pitch(customer.customerId)}`;
  }
}

/** The "Sisu is reading" moment between the profile choice and Today. */
export namespace OnboardingReading {
  /** While the overview loads: "Liito is sorting 12 months of Eetu's payments". */
  export function loadingTitle(name: string, months = 12): string { return `Liito is sorting ${months} months of ${name}'s payments`; }

  export const loadingDetail = "Sorting them into three baskets: regular essentials, occasional essentials and everyday spending.";

  /** Every categorised payment in the overview's window (the sum of the categories' counts). */
  export function paymentCount(overview: Overview): number {
    return overview.baskets.reduce((sum, basket) => sum + basket.categories.reduce((inner, category) => inner + category.count, 0), 0);
  }

  export const failedButton = "Pick a profile again";
}

/** The callout Today shows above the flagged bill on the first visit. */
export interface FirstInsightState {
  readonly eyebrow: string;
  /** "Looks like Electricity is your biggest bill after rent: about €79 a month." */
  readonly headline: string;
  /** Where the figure comes from, and why it matters. */
  readonly detail: string;
  /** "From 36 of Eetu's transactions". */
  readonly source: string;
  /** The link's visible words: "See them". */
  readonly seeLabel: string;
  /** Source and link as one sentence, the link's accessibility label. */
  readonly linkLabel: string;
  /** The transactions sheet's title and filter: the same rows the bill card opens. */
  readonly evidenceTitle: string;
  readonly evidence: EvidenceFilter;
  readonly dismissLabel: string;
}

export namespace FirstInsightPresenter {
  /** The first insight for this overview: the flagged bill, with its bills category. Null when there is no bill to flag. */
  export function state(overview: Overview, confirmedName: string | null = null): FirstInsightState | null {
    const owner = overview.displayName === "" ? "these" : `${overview.displayName}'s`;
    const bill = TodayPresenter.flaggedBill(overview);
    if (!bill) return null;
    const money = (amount: number) => Money.format(amount, "en");
    const name = confirmedName != null ? `${confirmedName} is` : `Looks like ${bill.guessLabel} is`;
    const headline = `${name} your biggest bill after rent: about ${money(bill.monthlyAvg)} a month.`;
    const category = overview.baskets.flatMap((basket) => basket.categories).find((c) => c.category === bill.category);
    const known = category != null && category.count > 0;
    const detail = known
      ? `All your ${bill.category.toLowerCase()} bills come to about ${money(category.monthlyAvg)} a month. Bills like these are often cheaper for new customers.`
      : bill.basis;
    const source = known ? `From ${category.count} of ${owner} transactions` : `From ${owner} transactions`;
    const seeLabel = "See them";
    return {
      eyebrow: "Liito found something",
      headline, detail, source, seeLabel,
      linkLabel: `${source} · ${seeLabel}`,
      evidenceTitle: `${bill.category} payments`,
      evidence: { from: overview.windowFrom, to: overview.windowTo, category: bill.category } as EvidenceFilter,
      dismissLabel: "Got it",
    };
  }
}
