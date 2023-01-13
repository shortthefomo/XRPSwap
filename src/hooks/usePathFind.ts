import { useEffect, useMemo, useState } from 'react'
import { PathFindCreateRequest, PathFindResponse, PathFindStream } from 'xrpl'
import { Amount, IssuedCurrencyAmount } from 'xrpl/dist/npm/models/common'

import { PathOption } from '@/@types/xrpl'
import { client } from '@/libs/xrpl'
import { parseToXrpAmount, parseAmountValue } from '@/utils/xrpl'

type Props = {
  account: string
  from: Amount
  to: Amount
}

export const usePathFind = ({ account: _account, from: _from, to: _to }: Props) => {
  const [active, setActive] = useState(false)
  const [account, setAccount] = useState(_account)
  const [from, setPathFrom] = useState<Amount>(_from)
  const [to, setPathTo] = useState<Amount>(_to)
  const [alternatives, setAlternatives] = useState<PathOption[]>([])

  useEffect(() => {
    setAlternatives([])
    if (['', '0'].includes(parseAmountValue(parseToXrpAmount(from)))) {
      setActive(false)
      return
    }
    setActive(true)
    client.connect().then(() => {
      client
        .request<PathFindCreateRequest, PathFindResponse>({
          command: 'path_find',
          subcommand: 'create',
          source_account: account,
          destination_account: account,
          destination_amount: parseToXrpAmount(transformDestAmount(to)),
          send_max: parseToXrpAmount(from),
        })
        .catch(() => null)
    })
  }, [account, from, to])

  useEffect(() => {
    const onPathFind = (stream: PathFindStream) => {
      if (!stream.full_reply) return
      const alternatives = stream.alternatives as PathOption[]
      setAlternatives(alternatives)
    }

    client.connect().then(() => {
      client.on('path_find', onPathFind)
    })

    return () => {
      client.request({ command: 'path_find', subcommand: 'close' }).catch(() => null)
    }
  }, [])

  const routes = useMemo(() => {
    if (!active) return null

    if (alternatives.length === 0) return null
    const route = alternatives.sort((pathA, pathB) => {
      let pathAAmount
      let pathBAmount
      if (typeof pathA.destination_amount === 'string') {
        // XRP
        pathAAmount = pathA.destination_amount
        pathBAmount = pathB.destination_amount as string
      } else {
        // IOU
        pathAAmount = pathA.destination_amount.value
        pathBAmount = (pathB.destination_amount as IssuedCurrencyAmount).value
      }
      return parseFloat(pathAAmount) - parseFloat(pathBAmount)
    })
    return route
  }, [active, alternatives])

  const bestRoute = useMemo(() => (routes ? routes[0] : null), [routes])

  return { setAccount, setPathFrom, setPathTo, bestRoute }
}

const transformDestAmount = (amount: Amount) => {
  if (typeof amount === 'string') {
    return '-1'
  }
  return { ...amount, value: '-1' }
}
