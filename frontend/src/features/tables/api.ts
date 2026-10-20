import { request } from '../../api/client'
import type { CreationContext, PokerTable, TableInput } from './types'

export const getCreationContext = () =>
  request<CreationContext>('/api/tables/creation-context/')
export const getTable = (id: string) =>
  request<PokerTable>(`/api/tables/${id}/`)
export const createTable = (input: TableInput, csrfToken: string) =>
  request<PokerTable>('/api/tables/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: JSON.stringify(input),
  })
