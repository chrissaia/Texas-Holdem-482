/**
 * Module: rules/RulesPage.tsx.
 * S8: a public rules page explaining Texas Hold'em and the hand rankings.
 * Layout follows Figma frame 26:3716 (Tutorial). The guided bot-practice table is left out
 * until bots and gameplay exist (S24); the learning path, hand reference and field guide are kept.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HAND_RANKINGS, LESSONS, SUIT_SYMBOLS, cardLabel, type Card } from './content'
import './rules.css'

/** One playing card face. Hearts and diamonds are red; the label names the card for screen readers. */
function PlayingCard({ card }: { card: Card }) {
  const red = card.suit === 'hearts' || card.suit === 'diamonds'
  return (
    <span className={`rules-card${red ? ' red' : ''}`} role="img" aria-label={cardLabel(card)}>
      <span aria-hidden="true">{card.rank}{SUIT_SYMBOLS[card.suit]}</span>
      <span className="rules-card-suit" aria-hidden="true">{SUIT_SYMBOLS[card.suit]}</span>
    </span>
  )
}

/** Render the rules page: a lesson path, the full hand reference and a summary field guide. */
export function RulesPage() {
  const [current, setCurrent] = useState(0)
  const lesson = LESSONS[current]
  const progress = Math.round(((current + 1) / LESSONS.length) * 100)
  return (
    <section className="rules-page">
      <header className="page-intro">
        <span className="eyebrow">LEARN TEXAS HOLD’EM</span>
        <h1>Start with the basics. Find your rhythm.</h1>
        <p className="muted">The rules, betting rounds and hand rankings in one place. Play money only.</p>
      </header>

      <div className="rules-learning">
        <nav className="panel rules-path" aria-labelledby="learning-path-heading">
          <h2 id="learning-path-heading">Your learning path</h2>
          <p className="muted rules-path-status">Lesson {current + 1} of {LESSONS.length} · {lesson.title}</p>
          <div
            className="rules-progress"
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuemin={1}
            aria-valuemax={LESSONS.length}
            aria-valuenow={current + 1}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <ol>
            {LESSONS.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`rules-lesson-link${index === current ? ' active' : ''}${index < current ? ' done' : ''}`}
                  aria-current={index === current ? 'step' : undefined}
                  onClick={() => setCurrent(index)}
                >
                  <span className="rules-lesson-mark" aria-hidden="true">{index < current ? '✓' : '○'}</span>
                  {item.title}
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="button quiet" onClick={() => setCurrent(0)} disabled={current === 0}>
            Restart tutorial
          </button>
        </nav>

        <article className="panel rules-lesson" aria-labelledby="lesson-heading">
          <span className="badge">Lesson {current + 1}</span>
          <h2 id="lesson-heading">{lesson.title}</h2>
          <p className="rules-lesson-summary">{lesson.summary}</p>
          {lesson.details.map(text => <p key={text}>{text}</p>)}
          <div className="rules-lesson-actions">
            <button type="button" className="button" disabled={current === 0} onClick={() => setCurrent(current - 1)}>
              ← Previous lesson
            </button>
            {current < LESSONS.length - 1 ? (
              <button type="button" className="button primary" onClick={() => setCurrent(current + 1)}>
                Next lesson: {LESSONS[current + 1].title} →
              </button>
            ) : (
              <Link className="button primary" to="/lobby">Find a table →</Link>
            )}
          </div>
        </article>
      </div>

      <section className="panel" aria-labelledby="hand-reference-heading">
        <div className="rules-section-heading">
          <h2 id="hand-reference-heading">The complete hand reference</h2>
          <span className="rules-order">Strongest → weakest</span>
        </div>
        <ol className="rules-hands">
          {HAND_RANKINGS.map((hand, index) => (
            <li key={hand.name} className="rules-hand">
              <div className="rules-hand-title">
                <span className="badge">{String(index + 1).padStart(2, '0')}</span>
                <h3>{hand.name}</h3>
              </div>
              <div className="rules-hand-body">
                <span className="rules-cards">
                  {hand.example.map(card => <PlayingCard key={`${card.rank}${card.suit}`} card={card} />)}
                </span>
                <span className="muted">{hand.description}</span>
              </div>
            </li>
          ))}
        </ol>
        <p className="muted rules-footnote">
          Aces can be high or low in a straight (A‑2‑3‑4‑5). Suits have equal value. If two players have the same hand,
          compare kickers or split the pot.
        </p>
      </section>

      <section className="panel" aria-labelledby="field-guide-heading">
        <h2 id="field-guide-heading">Your Hold’em field guide</h2>
        <ul className="rules-guide">
          {LESSONS.map((item, index) => (
            <li key={item.id}>
              <button type="button" className="rules-guide-card" onClick={() => setCurrent(index)}>
                <h3>{item.title}</h3>
                <p className="muted">{item.summary}</p>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}
