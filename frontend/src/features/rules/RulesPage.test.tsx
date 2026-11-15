/**
 * Regression tests: rules/RulesPage.test.tsx.
 * S8: the rules page explains poker, lists every hand ranking in order, and lets players move through lessons.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { HAND_RANKINGS, LESSONS, cardLabel } from './content'
import { RulesPage } from './RulesPage'

const page = () => render(<MemoryRouter><RulesPage /></MemoryRouter>)

test('lists all ten hand rankings from strongest to weakest with readable cards', () => {
  page()
  const reference = screen.getByRole('region', { name: 'The complete hand reference' })
  const names = within(reference).getAllByRole('heading', { level: 3 }).map(h => h.textContent)
  expect(names).toEqual([
    'Royal Flush', 'Straight Flush', 'Four of a Kind', 'Full House', 'Flush',
    'Straight', 'Three of a Kind', 'Two Pair', 'One Pair', 'High Card',
  ])
  expect(within(reference).getAllByRole('img', { name: 'Ace of spades' }).length).toBeGreaterThan(0)
  expect(within(reference).getAllByRole('img')).toHaveLength(50)
})

test('every example hand has five distinct cards', () => {
  for (const hand of HAND_RANKINGS) {
    expect(hand.example).toHaveLength(5)
    expect(new Set(hand.example.map(cardLabel)).size).toBe(5)
  }
})

test('starts on Poker Basics and moves forward, back and to a chosen lesson', () => {
  page()
  const lesson = screen.getByRole('article')
  expect(within(lesson).getByRole('heading', { name: 'Poker Basics' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '← Previous lesson' })).toBeDisabled()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')

  fireEvent.click(screen.getByRole('button', { name: 'Next lesson: Hand Rankings →' }))
  expect(within(lesson).getByRole('heading', { name: 'Hand Rankings' })).toBeInTheDocument()
  expect(screen.getByText('Lesson 2 of 9 · Hand Rankings')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '← Previous lesson' }))
  expect(within(lesson).getByRole('heading', { name: 'Poker Basics' })).toBeInTheDocument()

  const path = screen.getByRole('navigation', { name: 'Your learning path' })
  fireEvent.click(within(path).getByRole('button', { name: /Betting/ }))
  expect(within(lesson).getByText(/Check: pass the action without betting/)).toBeInTheDocument()
  expect(within(path).getByRole('button', { name: /Betting/ })).toHaveAttribute('aria-current', 'step')
})

test('the last lesson links to the lobby and restart returns to the first lesson', () => {
  page()
  const guide = screen.getByRole('region', { name: 'Your Hold’em field guide' })
  fireEvent.click(within(guide).getByRole('button', { name: /Poker Strategy Basics/ }))
  expect(screen.getByRole('link', { name: 'Find a table →' })).toHaveAttribute('href', '/lobby')
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(LESSONS.length))

  fireEvent.click(screen.getByRole('button', { name: 'Restart tutorial' }))
  expect(within(screen.getByRole('article')).getByRole('heading', { name: 'Poker Basics' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Restart tutorial' })).toBeDisabled()
})
