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
  let cards: Card[] = [];
  for (let color of colors) {
    cards.push({ type: "NUMBERED", color, number: 0 });
    for (let number = 1; number < 10; number++) {
      cards.push({ type: "NUMBERED", color, number });
      cards.push({ type: "NUMBERED", color, number });
    }
    for (let type of ["SKIP", "REVERSE", "DRAW"] as const) {
      cards.push({ type, color });
      cards.push({ type, color });
    }
  }
  for (let type of ["WILD", "WILD DRAW"] as const) {
    for (let _ of [1, 2, 3, 4]) {
      cards.push({ type });
    }
  }
  return createDeck(cards);
}

export function createDeck(cards: Card[]): Deck {
  return {
    get size() {
      return cards.length;
    },
    cards,
    shuffle: (shuffler: Shuffler<Card>) => shuffler(cards),
    deal: () => cards.shift(),
    filter: (predicate: (card: Card) => boolean) => {
      return createDeck(cards.filter(predicate));
    },
  };
}
