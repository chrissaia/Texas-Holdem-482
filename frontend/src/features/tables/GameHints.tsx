import type { GameLegalActions } from './types'

const chips = (amount: number) => amount.toLocaleString('en-US')

/** Explain only the actions the server currently permits for this player. */
export function GameHints({ legal, stack }: { legal: GameLegalActions; stack: number }) {
  return (
    <section className="game-hints" aria-label="Action hints">
      <h3>Available moves</h3>
      <ul>
        {legal.check && <li><strong>Check.</strong> Stay in the hand without adding chips.</li>}
        {legal.call && <li><strong>Call.</strong>{' '}
          {stack < legal.amount_to_call
            ? `Put in your remaining ${chips(stack)} chips to call all-in.`
            : `Match the bet by adding ${chips(legal.amount_to_call)} chips.`}
        </li>}
        {legal.raise && <li><strong>Raise.</strong>{' '}
          {legal.min_raise_to === legal.max_raise_to
            ? `Raise your total bet this round to ${chips(legal.min_raise_to)} chips.`
            : `Raise your total bet this round to ${chips(legal.min_raise_to)}–${chips(legal.max_raise_to)} chips.`}
        </li>}
        {legal.all_in && <li><strong>All-in.</strong> Put all {chips(stack)} of your remaining chips into the pot.</li>}
        {legal.fold && <li><strong>Fold.</strong> Give up this hand. Chips you’ve already put into the pot stay there.</li>}
      </ul>
    </section>
  )
}
