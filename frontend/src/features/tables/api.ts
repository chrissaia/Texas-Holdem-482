/**
 * Module: tables/api.ts.
 * Typed HTTP operations for tables, using the shared same-origin API client.
 */
import { request } from '../../api/client'
import type {
  CreationContext,
  PokerTable,
  TableInput,
  TableList,
} from './types'

/** Fetch host identity, profile summary and the table form's CSRF token. */
export const getCreationContext = () =>
  request<CreationContext>('/api/tables/creation-context/')
/** Fetch saved public-table settings by table ID. */
export const getTable = (id: string) =>
  request<PokerTable>(`/api/tables/${id}/`)
/** Post validated table settings with the authenticated form's CSRF token. */
export const createTable = (input: TableInput, csrfToken: string, privateTable = false) =>
  request<PokerTable>(privateTable ? '/api/tables/private/' : '/api/tables/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: JSON.stringify(input),
  })

/** Fetch public tables using the encoded lobby query parameters. */
export const listTables = (query: string) =>
  request<TableList>(`/api/tables/?${query}`)

export type SeatStatus = {
  table_id: number
  player_count: number
  chip_balance: number
  seat: { id: number; buy_in: number; stack: number } | null
  other_table_id: number | null
  csrf_token: string
}

export const getSeat = (id: number) => request<SeatStatus>(`/api/tables/${id}/seat/`)
export const changeSeat = (id: number, method: 'POST' | 'DELETE', token: string) =>
  request<SeatStatus>(`/api/tables/${id}/seat/`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token },
    body: JSON.stringify({}),
  })
