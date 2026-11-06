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
export const createTable = (input: TableInput, csrfToken: string) =>
  request<PokerTable>('/api/tables/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: JSON.stringify(input),
  })

/** Fetch public tables using the encoded lobby query parameters. */
export const listTables = (query: string) =>
  request<TableList>(`/api/tables/?${query}`)
