/* @flow */

import { warn } from './warn'

const encodeReserveRE = /[!'()*]/g
const encodeReserveReplacer = c => '%' + c.charCodeAt(0).toString(16)
const commaRE = /%2C/g

// fixed encodeURIComponent which is more conformant to RFC3986:
// - escapes [!'()*]
// - preserve commas
const encode = str => encodeURIComponent(str)
  .replace(encodeReserveRE, encodeReserveReplacer)
  .replace(commaRE, ',')

const decode = decodeURIComponent

export function resolveQuery (
  query: ?string,
  extraQuery: Dictionary<string> = {},
  _parseQuery: ?Function
): Dictionary<string> {
  const parse = _parseQuery || parseQuery
  let parsedQuery
  try {
    parsedQuery = parse(query || '')
  } catch (e) {
    process.env.NODE_ENV !== 'production' && warn(false, e.message)
    parsedQuery = {}
  }
  for (const key in extraQuery) {
    parsedQuery[key] = extraQuery[key]
  }
  return parsedQuery
}

// 把query组成对象
// a=1&b=2    {a: 1, b: 2}
function parseQuery (query: string): Dictionary<string> {
  const res = {}

  // 去除两端空格 替换以? # &开头 为空字符串
  query = query.trim().replace(/^(\?|#|&)/, '')

  // 如果值剩下空字符串 就直接返回
  if (!query) {
    return res
  }

  // 以&切割 然后遍历
  query.split('&').forEach(param => {
    // + 替换成空格 jq中也有类似的东西  接口接收问题
    // 然后再以=切割
    const parts = param.replace(/\+/g, ' ').split('=')
    // 取第一个元素
    const key = decode(parts.shift())
    // 如果还有多项 证明他的值里面就有= 再给他拼回去
    // ['1'].join('=')  结果还是 '1'
    const val = parts.length > 0
      ? decode(parts.join('='))
      : null

    if (res[key] === undefined) {
      // res中没有就存入
      res[key] = val
    } else if (Array.isArray(res[key])) {
      // 如果是个数组 就把当前项当做数组的一个元素
      res[key].push(val)
    } else {
      // res中已经有了 就把上一个取出来 组成数组
      res[key] = [res[key], val]
    }
  })

  return res
}

export function stringifyQuery (obj: Dictionary<string>): string {
  const res = obj ? Object.keys(obj).map(key => {
    const val = obj[key]

    if (val === undefined) {
      return ''
    }

    if (val === null) {
      return encode(key)
    }

    if (Array.isArray(val)) {
      const result = []
      val.forEach(val2 => {
        if (val2 === undefined) {
          return
        }
        if (val2 === null) {
          result.push(encode(key))
        } else {
          result.push(encode(key) + '=' + encode(val2))
        }
      })
      return result.join('&')
    }

    return encode(key) + '=' + encode(val)
  }).filter(x => x.length > 0).join('&') : null
  return res ? `?${res}` : ''
}
