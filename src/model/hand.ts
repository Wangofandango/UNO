import { Shuffler } from "../utils/random_utils";
import { Card, Color, createDeck, createInitialDeck, Deck } from "./deck";

export type Hand = {
  playerCount: number;
  dealer: number;
  currentPlayer: number;
  playerHands: Card[][];

  discardPile: () => DiscardPile;

  drawPile: () => Deck;
  draw: () => void;

  player: (playerIndex: number) => string;
  playerHand: (playerIndex: number) => Card[];

  play: (index: number, color?: Color) => void;
  playerInTurn: () => number | undefined;

  canPlay: (playerIndex: number) => boolean;
  canPlayAny: () => boolean;

  catchUnoFailure: (params: { accuser: number; accused: number }) => boolean;
  sayUno: (playerIndex: number) => void;

  score: () => number | undefined;
  winner: () => number | undefined;
  hasEnded: () => boolean;
  onEnd: (callback: (params: { winner: number }) => void) => void;
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

export function createHand({
  players,
  dealer,
  shuffler,
  cardsPerPlayer,
}: HandParams): Hand {
  if (players.length < 2) {
    throw new Error("At least 2 players are required");
  } else if (players.length > 10) {
    throw new Error("At most 10 players are allowed");
  }

  const playerHands: Card[][] = [];

  let direction = 1;

  let canAccuseUnoFailure = true;
  const unoCalls: boolean[] = new Array(players.length).fill(false);

  const onEndCallbacks: Parameters<Hand["onEnd"]>[0][] = [];

  let deck = createInitialDeck();
  deck.shuffle(shuffler);

  const drawCards = (playerIndex: number, amount: number) => {
    if (deck.size === 0) {
      deck = createDeck(discardedPile.cards.slice(0, -1));
      deck.shuffle(shuffler);

      discardedPile.cards = [discardedPile.top()];
    }

    const playerHand = playerHands[playerIndex];

    for (let i = 0; i < amount; i++) {
      const newCard = deck.deal();
      playerHand.push(newCard as Card);
    }

    if (playerHand.length > 1) {
      unoCalls[playerIndex] = false;
    }
  };

  // Deal cards to players
  for (let i = 0; i < players.length; i++) {
    playerHands.push([]);
    for (let j = 0; j < (cardsPerPlayer ?? 7); j++) {
      drawCards(i, 1);
    }
  }

  // Reshuffle to avoid starting with a WILD card
  while (deck.cards[0].type === "WILD" || deck.cards[0].type === "WILD DRAW") {
    deck.shuffle(shuffler);
  }

  const discardedPile: DiscardPile = {
    size: 1,
    cards: [deck.deal() as Card],
    top: () => discardedPile.cards[0],
  };

  const getNextPlayerIndex = (params?: { skip?: boolean }) => {
    const modifier = params?.skip ? direction * 2 : direction;
    return (currentPlayer + modifier + players.length) % players.length;
  };

  const advanceTurn = (params?: { skip?: boolean }) => {
    currentPlayer = getNextPlayerIndex(params);
    canAccuseUnoFailure = true;
  };

  if (discardedPile.top().type === "REVERSE") {
    direction = -1;
  }

  let currentPlayer = dealer;
  currentPlayer = getNextPlayerIndex({
    skip: discardedPile.top().type === "SKIP",
  });

  if (discardedPile.top().type === "DRAW") {
    drawCards(currentPlayer, 2);
    advanceTurn();
  }

  const player: Hand["player"] = (playerIndex) => {
    if (playerIndex < 0 || playerIndex >= players.length) {
      throw new Error("Player index out of bounds");
    }
    return players[playerIndex];
  };

  const playerHand: Hand["playerHand"] = (playerIndex: number) => {
    if (playerIndex < 0 || playerIndex >= players.length) {
      throw new Error("Player index out of bounds");
    }
    return playerHands[playerIndex];
  };

  const playerInTurn: Hand["playerInTurn"] = () => {
    if (hasEnded()) return;
    return currentPlayer;
  };

  const draw: Hand["draw"] = () => {
    if (hasEnded()) {
      throw new Error("Game has ended");
    }

    drawCards(currentPlayer, 1);

    if (!canPlayAny()) {
      advanceTurn();
    }

    canAccuseUnoFailure = false;
    players.forEach((_, index) => {
      if (index !== currentPlayer) {
        unoCalls[index] = playerHands[index].length === 1;
      }
    });
  };

  const hasEnded: Hand["hasEnded"] = () => {
    return playerHands.some((hand) => hand.length === 0);
  };

  const canPlay: Hand["canPlay"] = (cardIndex) => {
    if (hasEnded()) return false;

    const playerHand = playerHands[currentPlayer];

    const card = playerHand[cardIndex];
    if (!card) return false;

    const topCard = discardedPile.top();

    return isPlayable(playerHand, card, topCard);
  };

  const canPlayAny: Hand["canPlayAny"] = () => {
    const playerHand = playerHands[currentPlayer];
    const topCard = discardedPile.top();
    return playerHand.some((card) => isPlayable(playerHand, card, topCard));
  };

  const sayUno: Hand["sayUno"] = (playerIndex) => {
    if (hasEnded()) throw new Error("Game has ended");

    if (playerIndex < 0 || playerIndex >= players.length) {
      throw new Error("Player index out of bounds");
    }

    if (playerHands[playerIndex].length > 2) return;

    unoCalls[playerIndex] = true;
  };

  const catchUnoFailure: Hand["catchUnoFailure"] = ({
    accuser: _,
    accused,
  }) => {
    const isUnoFailure =
      canAccuseUnoFailure &&
      !unoCalls[accused] &&
      playerHands[accused].length === 1;

    if (isUnoFailure) {
      drawCards(accused, 4);
    }

    return isUnoFailure;
  };

  const winner: Hand["winner"] = () => {
    const winnerIndex = playerHands.findIndex((hand) => hand.length === 0);
    if (winnerIndex === -1) return;
    return winnerIndex;
  };

  const score: Hand["score"] = () => {
    if (!hasEnded()) return;

    return playerHands.reduce((acc, hand) => {
      return acc + getCardsScore(hand);
    }, 0);
  };

  const onEnd: Hand["onEnd"] = (callback) => {
    onEndCallbacks.push(callback);
  };

  const play: Hand["play"] = (cardIndex: number, color?: Color) => {
    if (hasEnded()) {
      throw new Error("Game has ended");
    }

    const playerHand = playerHands[currentPlayer];
    const card = playerHand[cardIndex];

    if (!card) {
      throw new Error("Card not found");
    }

    if (card.color && color) {
      throw new Error("Cannot set colour of a non-WILD card");
    }

    if (!canPlay(cardIndex)) {
      throw new Error("Cannot play this card");
    }

    if (card.type === "WILD" || card.type === "WILD DRAW") {
      if (!color) {
        throw new Error("Color is required for WILD cards");
      }
    }

    playerHand.splice(cardIndex, 1);
    discardedPile.cards.unshift(card);

    if (card.type === "WILD" || card.type === "WILD DRAW") {
      discardedPile.cards[0].color = color;
    }

    canAccuseUnoFailure = false;
    players.forEach((_, index) => {
      if (index !== currentPlayer) {
        unoCalls[index] = playerHands[index].length === 1;
      }
    });

    if (card.type === "REVERSE") {
      direction *= -1;
    } else if (card.type === "DRAW") {
      drawCards(getNextPlayerIndex(), 2);
    } else if (card.type === "WILD DRAW") {
      drawCards(getNextPlayerIndex(), 4);
    }

    if (playerHand.length === 0) {
      onEndCallbacks.forEach((callback) => {
        callback({ winner: currentPlayer });
      });
      return card;
    }

    advanceTurn({
      skip:
        card.type === "SKIP" ||
        card.type === "DRAW" ||
        card.type === "WILD DRAW",
    });

    return card;
  };

  return {
    currentPlayer,
    playerHands,
    playerCount: players.length,
    dealer,

    discardPile: () => discardedPile,
    drawPile: () => deck,

    player,
    playerHand,

    playerInTurn,
    canPlay,
    canPlayAny,
    draw,
    sayUno,
    catchUnoFailure,
    hasEnded,
    winner,
    score,
    onEnd,
    play,
  };
}

export const isPlayable = (playerHand: Card[], card: Card, topCard: Card) => {
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

export const getCardsScore = (cards: Card[]) => {
  return cards.reduce((acc, card) => acc + getCardScore(card), 0);
};

export const getCardScore = (card: Card) => {
  if (card.number) return card.number;
  if (card.type === "WILD" || card.type === "WILD DRAW") return 50;
  return 20;
};
