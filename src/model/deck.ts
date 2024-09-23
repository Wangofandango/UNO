import { Shuffler } from "../utils/random_utils";

export type Deck = {
  size: number;
  cards: Card[];

  shuffle: (shuffler: Shuffler<Card>) => void;
  deal: () => Card | undefined;
  filter: (predicate: (card: Card) => boolean) => Deck;
};

export const types = [
  "NUMBERED",
  "SKIP",
  "REVERSE",
  "DRAW",
  "WILD",
  "WILD DRAW",
] as const;
export type Type = (typeof types)[number];

export const colors = ["RED", "YELLOW", "GREEN", "BLUE"] as const;
export type Color = (typeof colors)[number];

export type Card = {
  type: Type;
  color?: Color;
  number?: number;
};

export function createInitialDeck(): Deck {
  const cards: Card[] = [];

  for (let color of colors) {
    // 1x 0-numbered cards of each color
    cards.push({ type: "NUMBERED", color, number: 0 });

    // 2x 1-9 numbered cards of each color
    for (let number = 1; number <= 9; number++) {
      for (const _ of Array(2)) {
        cards.push({ type: "NUMBERED", color, number });
      }
    }

    // 2x of each special card of each color
    for (const type of ["SKIP", "REVERSE", "DRAW"] as const) {
      for (const _ of Array(2)) {
        cards.push({ type, color });
      }
    }
  }

  // 4x of each wild card
  for (const type of ["WILD", "WILD DRAW"] as const) {
    for (const _ of Array(4)) {
      cards.push({ type });
    }
  }

  return createDeck(cards);
}

export function createDeck(cards: Card[]): Deck {
  const shuffle: Deck["shuffle"] = (shuffler) => shuffler(cards);

  const deal: Deck["deal"] = () => cards.shift();

  const filter: Deck["filter"] = (predicate) => {
    return createDeck(cards.filter(predicate));
  };

  return {
    cards,
    shuffle,
    deal,
    filter,
    get size() {
      return cards.length;
    },
  };
}
