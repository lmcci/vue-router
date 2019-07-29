/* @flow */

import { warn } from './warn'
import Regexp from 'path-to-regexp'

// $flow-disable-line
const regexpCompileCache: {
  [key: string]: Function
} = Object.create(null)

export function fillParams (
  path: string,
  params: ?Object,
  routeMsg: string
): string {
  try {
    // 根据path计算出 一个方法放入regexpCompileCache 中缓存
    // 第二次 直接取出使用
    const filler =
      regexpCompileCache[path] ||
      (regexpCompileCache[path] = Regexp.compile(path))
    // todo ？？？没理解
    return filler(params || {}, { pretty: true })
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      warn(false, `missing param for ${routeMsg}: ${e.message}`)
    }
    return ''
  }
}
