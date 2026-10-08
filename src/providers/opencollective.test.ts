import { $fetch } from 'ofetch'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchOpenCollectiveSponsors } from './opencollective.js'

vi.mock('ofetch', () => ({ $fetch: vi.fn() }))
const fetchMock = vi.mocked($fetch)

beforeEach(() => fetchMock.mockReset())

const emptyOrders = { data: { account: { orders: { nodes: [], totalCount: 0 } } } }
const emptyTransactions = { data: { account: { transactions: { nodes: null, totalCount: 0 } } } }

describe('OpenCollective GraphQL responses', () => {
  it.each(['subscriptions', 'transactions'])('reports %s errors before accessing missing data', async (stage) => {
    if (stage === 'transactions')
      fetchMock.mockResolvedValueOnce(emptyOrders)
    fetchMock.mockResolvedValueOnce({ data: null, errors: [{ message: 'Rate limit exceeded' }, { message: 'Try again later' }] })
    await expect(fetchOpenCollectiveSponsors('key', undefined, 'collective'))
      .rejects.toThrow('OpenCollective query errors: Rate limit exceeded; Try again later')
    expect(fetchMock).toHaveBeenCalledTimes(stage === 'transactions' ? 2 : 1)
  })

  it('accepts empty and null node lists', async () => {
    fetchMock.mockResolvedValueOnce(emptyOrders).mockResolvedValueOnce(emptyTransactions)
    await expect(fetchOpenCollectiveSponsors('key', undefined, 'collective')).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('preserves sponsees mode by fetching transactions directly', async () => {
    fetchMock.mockResolvedValueOnce(emptyTransactions)
    await expect(fetchOpenCollectiveSponsors('key', undefined, 'collective', undefined, true, true)).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]?.body).toMatchObject({ query: expect.stringContaining('type: DEBIT') })
  })
})
