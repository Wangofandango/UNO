import { Shuffler } from "../utils/random_utils";
import { Card, CardColor, createInitialDeck, Deck } from "./deck";

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
  play: (number: number, color?: CardColor) => void;
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
};

export function createHand(params: HandParams): Hand {
  const playerHands: Card[][] = [];
  const deck = createInitialDeck();
  const discardedPile: DiscardPile = {
    size: 1,
    cards: [deck.deal() as Card],
    top: () => {
      return discardedPile.cards[0]; //Maybe this is wrong
    },
  };
  const drawablePile = deck;
  let currentPlayer = params.dealer + (1 % params.players.length);

  const canPlay = (playerIndex: number) => {
    const playerHand = playerHands[playerIndex];
    const topCard = discardedPile.top();

    return playerHand.some(
      (card) =>
        card.color === topCard.color ||
        card.number === topCard.number ||
        card.type === "WILD" ||
        card.type === "WILD DRAW" ||
        (card.type !== "NUMBERED" && card.type === topCard.type)
    );
  };

  return {
    currentPlayer,
    playerHands,
    playerCount: params.players.length,
    dealer: params.dealer,
    discardedPile,
    drawablePile,

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
      return playerHands[playerIndex];
    },
    discardPile: () => {
      return discardedPile;
    },
    drawPile: () => {
      return drawablePile;
    },
    playerInTurn: () => currentPlayer,
    canPlay,
    canPlayAny: () => canPlay(currentPlayer),
    draw: () => {
      const playerHand = playerHands[currentPlayer];
      playerHand.push(drawablePile.deal() as Card);
    },
    // TODO: do it
    play: (number: number, color?: CardColor) => {
      const playerHand = playerHands[currentPlayer];
      const topCard = discardedPile.top();
    },
  };
}
