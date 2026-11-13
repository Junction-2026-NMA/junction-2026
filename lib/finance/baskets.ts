import type { BasketId } from "@/lib/types";

// The three S-Pankki baskets. Every spending category maps to exactly one, with a reason we can show.
export const BASKETS: Record<BasketId, { label: string; description: string }> = {
  regular: {
    label: "Must pay, every month",
    description: "Fixed commitments like rent and bills. They arrive on schedule whether you plan for them or not.",
  },
  irregular: {
    label: "Must pay, now and then",
    description: "Necessary costs that come in lumps: a repair, a dentist, a broken phone. Easy to forget, so set money aside.",
  },
  everyday: {
    label: "Everyday choices",
    description: "Food, transport and fun. Small amounts that quietly add up, and the basket you control most.",
  },
};

const CATEGORY_BASKET: Record<string, { basket: BasketId; reason: string }> = {
  Housing: { basket: "regular", reason: "One payment every month that you cannot skip." },
  Utilities: { basket: "regular", reason: "Bills that come every month, even if the amount moves a little." },
  Health: { basket: "irregular", reason: "Needed when it happens, but you cannot predict when." },
  "Home & Tech": { basket: "irregular", reason: "Repairs, appliances and furniture arrive rarely and in large lumps." },
  Groceries: { basket: "everyday", reason: "Needed, but how much you spend is a daily choice." },
  Restaurants: { basket: "everyday", reason: "Frequent small purchases that are fully your choice." },
  Transportation: { basket: "everyday", reason: "Daily travel costs that vary with your habits." },
  Entertainment: { basket: "everyday", reason: "Optional and frequent." },
  Lifestyle: { basket: "everyday", reason: "Clothes, hobbies and shopping: optional." },
  Travel: { basket: "everyday", reason: "Optional, even when the amounts are large." },
};

export const SAVING_CATEGORIES = ["Invest Deposit"];
export const INCOME_CATEGORIES = ["Salary", "Other Income"];

export function basketOf(category: string): { basket: BasketId; reason: string } | null {
  return CATEGORY_BASKET[category] ?? null;
}

export const BASKET_ORDER: BasketId[] = ["regular", "irregular", "everyday"];

// Merchant category codes present in the dataset, so questions like "how much on taxis?" can be answered.
export const MCC_LABELS: Record<string, string> = {
  "4111": "Public transport", "4121": "Taxi", "4511": "Airline", "4722": "Travel agency",
  "5200": "Home supplies", "5251": "Hardware store", "5411": "Supermarket", "5422": "Meat and frozen food",
  "5451": "Dairy shop", "5499": "Convenience store", "5541": "Fuel station", "5542": "Fuel pump",
  "5651": "Clothing", "5691": "Clothing", "5712": "Furniture", "5732": "Electronics", "5734": "Software",
  "5812": "Restaurant", "5813": "Bar", "5814": "Fast food", "5912": "Pharmacy", "5941": "Sports gear",
  "5942": "Bookshop", "5945": "Hobby and toys", "5999": "Other retail", "7011": "Hotel", "7512": "Car rental",
  "7523": "Parking", "7832": "Cinema", "7922": "Tickets and events", "7991": "Attractions",
  "7996": "Amusement park", "7999": "Recreation", "8011": "Doctor", "8021": "Dentist", "8099": "Health services",
};
