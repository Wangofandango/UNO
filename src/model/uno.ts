import {
  Randomizer,
  Shuffler,
  standardRandomizer,
  standardShuffler,
} from "../utils/random_utils";
import { Card } from "./deck";
import { createHand, Hand, HandParams } from "./hand";

export type Game = {
  playerCount: number;
  targetScore: number;

  player: (playerIndex: number) => string;
  currentHand: () => Hand | undefined;
  score: (playerIndex: number) => number;
  winner: () => number | undefined;
};

export type GameParams = {
  players?: string[];
  targetScore?: number;
  randomizer?: Randomizer;
  shuffler?: Shuffler<Card>;
  cardsPerPlayer?: number;
};

export const createGame = ({
  players = ["A", "B"],
  targetScore = 500,
  randomizer = standardRandomizer,
  shuffler = standardShuffler,
  cardsPerPlayer,
}: GameParams): Game => {
  if (targetScore <= 0) {
    throw new Error("Target score must be greater than 0");
  }

  let winnerInternal: number | undefined = undefined;

  const scores = players.map(() => 0);

  let hand: Hand | undefined = undefined;

  const startNewHand = () => {
    hand = createHand({
      players,
      dealer: randomizer(players.length),
      shuffler,
      cardsPerPlayer,
    });

    hand.onEnd(({ winner }) => {
      scores[winner] += hand!.score() || 0;
      if (scores[winner] >= targetScore) {
        winnerInternal = winner;
        hand = undefined;
      } else {
        startNewHand();
      }
    });
  };

  startNewHand();

  const player = (playerIndex: number) => {
    if (playerIndex < 0 || playerIndex >= players.length) {
      throw new Error("Player index out of bounds");
    }
    return players[playerIndex];
  };

  const currentHand = () => hand;
  const score = (playerIndex: number) => scores[playerIndex];
  const winner = () => winnerInternal;

  return {
    playerCount: players.length,
    targetScore,
    player,
    currentHand,
    score,
    winner,
  };
};
