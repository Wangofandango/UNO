import { Shuffler } from "../utils/random_utils";
import { Card, Color, createDeck, createInitialDeck, Deck } from "./deck";

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
  playerInTurn: () => number | undefined;
  canPlay: (playerIndex: number) => boolean;
  canPlayAny: () => boolean;
  draw: () => void;

  catchUnoFailure: (params: { accuser: number; accused: number }) => boolean;
  sayUno: (playerIndex: number) => void;

  hasEnded: () => boolean;
  winner: () => number | undefined;
  score: () => number | undefined;

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

  const playerCount = params.players.length;
  const playerHands: Card[][] = [];

  let direction = 1;

  let canAccuseUnoFailure = true;
  const unoCalls: boolean[] = new Array(params.players.length).fill(false);

  const onEndCallbacks: Parameters<Hand["onEnd"]>[0][] = [];

  let deck = createInitialDeck();
  deck.shuffle(params.shuffler);

  const drawCards = (playerIndex: number, amount: number) => {
    if (deck.size === 0) {
      deck = createDeck(discardedPile.cards.slice(0, -1));
      deck.shuffle(params.shuffler);

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
  for (let i = 0; i < params.players.length; i++) {
    playerHands.push([]);
    for (let j = 0; j < (params?.cardsPerPlayer ?? 7); j++) {
      drawCards(i, 1);
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

  const getNextPlayerIndex = (params?: { skip?: boolean }) => {
    const modifier = params?.skip ? direction * 2 : direction;
    return (currentPlayer + modifier + playerCount) % playerCount;
  };

  const advanceTurn = (params?: { skip?: boolean }) => {
    currentPlayer = getNextPlayerIndex(params);
    canAccuseUnoFailure = true;
  };

  let indexModifier = 1;

  if (discardedPile.top().type === "REVERSE") {
    indexModifier = -1;
  } else if (discardedPile.top().type === "SKIP") {
    indexModifier = 2;
  }

  let currentPlayer =
    (params.dealer + indexModifier + params.players.length) %
    params.players.length;

  if (discardedPile.top().type === "DRAW") {
    drawCards(currentPlayer, 2);
    advanceTurn();
  }

  const hasEnded = () => {
    return playerHands.some((hand) => hand.length === 0);
  };

  const canPlay = (cardIndex: number) => {
    if (hasEnded()) return false;

    const playerHand = playerHands[currentPlayer];

    const card = playerHand[cardIndex];
    if (!card) return false;

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
      return playerHands[playerIndex];
    },
    discardPile: () => discardedPile,
    drawPile: () => deck,
    playerInTurn: () => {
      if (hasEnded()) return;
      return currentPlayer;
    },
    canPlay,
    canPlayAny: () => canPlay(currentPlayer),
    draw: () => {
      if (hasEnded()) {
        throw new Error("Game has ended");
      }

      drawCards(currentPlayer, 1);

      if (!canPlayAny()) {
        advanceTurn();
      }

      canAccuseUnoFailure = false;
      params.players.forEach((_, index) => {
        if (index !== currentPlayer) {
          unoCalls[index] = playerHands[index].length === 1;
        }
      });
    },
    play: (cardIndex: number, color?: Color) => {
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
      params.players.forEach((_, index) => {
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
    },
    sayUno: (playerIndex: number) => {
      if (hasEnded()) {
        throw new Error("Game has ended");
      }

      if (playerIndex < 0 || playerIndex >= params.players.length) {
        throw new Error("Player index out of bounds");
      }

      if (playerHands[playerIndex].length > 2) {
        return;
      }

      unoCalls[playerIndex] = true;
    },
    catchUnoFailure: ({ accuser, accused }) => {
      console.log("CALLS: ", unoCalls);
      console.log("CAN ACCUSE: ", canAccuseUnoFailure);
      const isUnoFailure =
        canAccuseUnoFailure &&
        !unoCalls[accused] &&
        playerHands[accused].length === 1;

      if (isUnoFailure) {
        drawCards(accused, 4);
      }

      return isUnoFailure;
    },
    hasEnded,
    winner: () => {
      const winnerIndex = playerHands.findIndex((hand) => hand.length === 0);
      if (winnerIndex === -1) return;
      return winnerIndex;
    },
    score: () => {
      if (!hasEnded()) return;

      return playerHands.reduce((acc, hand) => {
        const playerHandScore = hand.reduce((acc, card) => {
          let cardScore = 0;
          if (card.number) cardScore = card.number;
          if (card.type === "DRAW") cardScore = 20;
          if (card.type === "REVERSE") cardScore = 20;
          if (card.type === "SKIP") cardScore = 20;
          if (card.type === "WILD") cardScore = 50;
          if (card.type === "WILD DRAW") cardScore = 50;
          return acc + cardScore;
        }, 0);

        return acc + playerHandScore;
      }, 0);
    },
    onEnd: (callback) => {
      onEndCallbacks.push(callback);
    },
  };
}
