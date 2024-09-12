import { Shuffler } from "../utils/random_utils";
import { Card, Color, createInitialDeck, Deck } from "./deck";

export type Hand = {
  playerCount: number;
  dealer: number;
  currentPlayer: number;
  playerHands: Card[][];

  discardedPile: DiscardPile;
  drawablePile: Deck;

  player: (playerIndex: number) => string;
  playerHand: (playerIndex: number) => Card[];
  discardPile: () => DiscardPile;
  drawPile: () => Deck;
  play: (index: number, color?: Color) => void;
  // throws if outofbounds or WILD without color
  playerInTurn: () => number;
  canPlay: (playerIndex: number) => boolean;
  canPlayAny: () => boolean;
  draw: () => void;
};

export type DiscardPile = {
  size: number;
  cards: Card[];
  top: () => Card;
};

export type HandParams = {
  players: string[];
  dealer: number;
  shuffler: Shuffler<Card>;
  cardsPerPlayer?: number;
};

const isPlayable = (playerHand: Card[], card: Card, topCard: Card) => {
  if (card.color === topCard.color) return true;

  if (card.type === "WILD") return true;

  if (card.type === "WILD DRAW") {
    // check if player already has the current color in hand
    return playerHand.every((c) => c.color !== topCard.color);
  }

  if (card.type === "NUMBERED" && card.number === topCard.number) {
    return true;
  }

  return card.type === topCard.type && card.type !== "NUMBERED";
};

export function createHand(params: HandParams): Hand {
  if (params.players.length < 2) {
    throw new Error("At least 2 players are required");
  } else if (params.players.length > 10) {
    throw new Error("At most 10 players are allowed");
  }

  const playerHands: Card[][] = [];

  const deck = createInitialDeck();
  deck.shuffle(params.shuffler);

  // Deal cards to players
  for (let i = 0; i < params.players.length; i++) {
    playerHands.push([]);
    for (let j = 0; j < (params?.cardsPerPlayer ?? 7); j++) {
      playerHands[i].push(deck.deal() as Card);
    }
  }

  while (deck.cards[0].type === "WILD" || deck.cards[0].type === "WILD DRAW") {
    deck.shuffle(params.shuffler);
  }

  const discardedPile: DiscardPile = {
    size: 1,
    cards: [deck.deal() as Card],
    top: () => discardedPile.cards[0],
  };

  const indexModifier =
    discardedPile.top().type === "SKIP"
      ? 2
      : discardedPile.top().type === "REVERSE"
      ? -1
      : 1;

  let currentPlayer = (params.dealer + indexModifier) % params.players.length;
  currentPlayer = currentPlayer < 0 ? params.players.length - 1 : currentPlayer;

  if (discardedPile.top().type === "DRAW") {
    playerHands[currentPlayer].push(deck.deal() as Card);
    playerHands[currentPlayer].push(deck.deal() as Card);
    currentPlayer = (currentPlayer + 1) % params.players.length;
  }

  const drawCard = () => {
    const playerHand = playerHands[currentPlayer];
    const newCard = deck.deal();
    playerHand.push(newCard as Card);
  };

  const canPlay = (cardIndex: number) => {
    const playerHand = playerHands[currentPlayer];

    const card = playerHand[cardIndex];
    if (!card) return;

    const topCard = discardedPile.top();

    return isPlayable(playerHand, card, topCard);
  };

  const canPlayAny = () => {
    const playerHand = playerHands[currentPlayer];
    const topCard = discardedPile.top();
    return playerHand.some((card) => isPlayable(playerHand, card, topCard));
  };

  return {
    currentPlayer,
    playerHands,
    playerCount: params.players.length,
    dealer: params.dealer,
    discardedPile,
    drawablePile: deck,

    player: (playerIndex: number) => {
      if (playerIndex < 0 || playerIndex >= params.players.length) {
        throw new Error("Player index out of bounds");
      }
      return params.players[playerIndex];
    },
    playerHand: (playerIndex: number) => {
      if (playerIndex < 0 || playerIndex >= params.players.length) {
        throw new Error("Player index out of bounds");
      }
      console.log("play hand at index", playerIndex, playerHands[playerIndex]);
      return playerHands[playerIndex];
    },
    discardPile: () => discardedPile,
    drawPile: () => {
      console.log(deck.cards);
      return deck;
    },
    playerInTurn: () => currentPlayer,
    canPlay,
    canPlayAny: () => canPlay(currentPlayer),
    draw: drawCard,
    // TODO: do it
    play: (cardIndex: number, color?: Color) => {
      const playerHand = playerHands[currentPlayer];
      const topCard = discardedPile.top();
      const card = playerHand[cardIndex];

      if (!card) {
        throw new Error("Card not found");
      }

      if (!canPlay(cardIndex)) {
        return;
      }

      console.log("PLAYED CARD: ", card);

      playerHand.splice(cardIndex, 1);
      discardedPile.cards.unshift(card);

      if (card.type === "WILD" || card.type === "WILD DRAW") {
        if (!color) {
          throw new Error("Color is required for WILD cards");
        }

        discardedPile.cards[0].color = color;
      }

      if (card.type === "REVERSE") {
        params.players.reverse();
      } else if (card.type === "SKIP") {
        currentPlayer = (currentPlayer + 1) % params.players.length;
      } else if (card.type === "DRAW") {
        const nextPlayer = (currentPlayer + 1) % params.players.length;
        playerHands[nextPlayer].push(deck.deal() as Card);
        playerHands[nextPlayer].push(deck.deal() as Card);
      } else if (card.type === "WILD DRAW") {
        const nextPlayer = (currentPlayer + 1) % params.players.length;
        playerHands[nextPlayer].push(deck.deal() as Card);
        playerHands[nextPlayer].push(deck.deal() as Card);
        playerHands[nextPlayer].push(deck.deal() as Card);
        playerHands[nextPlayer].push(deck.deal() as Card);
      }

      currentPlayer = (currentPlayer + 1) % params.players.length;

      if (playerHand.length === 0) {
        throw new Error("Player has won");
      }

      if (!canPlayAny()) {
        drawCard();
      }

      return;
    },
  };
}
