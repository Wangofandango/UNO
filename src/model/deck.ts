import { Shuffler } from "../utils/random_utils"

export type Deck = {
    size: number
    cards: Card[]

    shuffle: (shuffler: Shuffler<Card>) => void
    deal: () => Card | undefined
}

const CARD_TYPES = ['NUMBER', 'SKIP', 'REVERSE', 'DRAW', 'WILD', 'WILD DRAW'] as const
export type CardType = typeof CARD_TYPES[number]

const CARD_COLORS = ['RED', 'YELLOW', 'GREEN', 'BLUE', 'BLACK'] as const
export type CardColor = typeof CARD_COLORS[number]

export type Card = {

    type: CardType
    color: CardColor
    number?: number
}

export function createInitialDeck(): Deck {
    let cards: Card[] = []
    for(let color of CARD_COLORS) {
        cards.push({type: 'NUMBER', color, number: 0})
        for(let number = 1; number < 10; number++) {
            cards.push({type: 'NUMBER', color, number})
            cards.push({type: 'NUMBER', color, number})
        }
        for(let type of ['SKIP', 'REVERSE', 'DRAW'] as const) {
            cards.push({type, color})
            cards.push({type, color})
        }
    }
    for(let type of ['WILD', 'WILD DRAW'] as const) {
        for(let _ of [1, 2, 3, 4]) {
            cards.push({type, color: 'BLACK'})
        }
    }
    return {
        size: cards.length,
        cards,
        shuffle: (shuffler: Shuffler<Card>) => shuffler(cards),
        deal: () => cards.pop()
    }
}


