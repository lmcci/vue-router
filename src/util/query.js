/* @flow */

import { warn } from './warn'

const encodeReserveRE = /[!'()*]/g
const encodeReserveReplacer = c => '%' + c.charCodeAt(0).toString(16)
const commaRE = /%2C/g

// fixed encodeURIComponent which is more conformant to RFC3986:
// - escapes [!'()*]
// - preserve commas
// 加密
const encode = str => encodeURIComponent(str)
  // 加密后还要替换一些东西 为啥替换不知道
  .replace(encodeReserveRE, encodeReserveReplacer)
  .replace(commaRE, ',')

// 解码
const decode = decodeURIComponent

// 把query字符串数据转换成键值对的对象
export function resolveQuery (
  query: ?string,
  extraQuery: Dictionary<string> = {},
  _parseQuery: ?Function
): Dictionary<string> {
  // 有传入的用传入的函数 没有用下面定义的
  const parse = _parseQuery || parseQuery
  let parsedQuery
  try {
    // 调用函数 把传入的字符串 转换成数组
    parsedQuery = parse(query || '')
  } catch (e) {
    // 报错就抛个错误
    process.env.NODE_ENV !== 'production' && warn(false, e.message)
    // 也要赋个默认值
    parsedQuery = {}
  }
  // 把额外的参数 也要放在 上面转换的对象上
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

// 传入一个对象 返回一个字符串
export function stringifyQuery (obj: Dictionary<string>): string {
  // 遍历传入的对象
  // 组成一个字符串数组 过滤空字符串 然后用 &拼接
  const res = obj ? Object.keys(obj).map(key => {
    const val = obj[key]

    // 没有值 就返回空字符串
    if (val === undefined) {
      return ''
    }

    // 没有值 值返回键（没有a=b  只有a） 在加密一次
    if (val === null) {
      return encode(key)
    }

    // 值如果是一个数组
    if (Array.isArray(val)) {
      const result = []
      // 遍历数组每一项
      val.forEach(val2 => {
        // 和上面操作类似
        if (val2 === undefined) {
          return
        }
        // 为空就只拼接键
        if (val2 === null) {
          result.push(encode(key))
        } else {
          // 有值 拼接键和等号和值
          result.push(encode(key) + '=' + encode(val2))
        }
      })
      // 把所有的都用&拼接 当成一项
      return result.join('&')
    }

    // 键和值全部加密一次 拼接= 返回
    return encode(key) + '=' + encode(val)
  }).filter(x => x.length > 0).join('&') : null
  // 前面过滤一波 还有值 就在前面拼接一个 ?
  return res ? `?${res}` : ''
}
