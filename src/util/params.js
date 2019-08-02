/* @flow */

import { warn } from './warn'
import Regexp from 'path-to-regexp'

// $flow-disable-line
// 定义一个空对象 缓存使用
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
    // var url = '/user/:id/:name'
    // var data = {id: 10001, name: 'bob'}
    // console.log(pathToRegexp.compile(url)(data))
    // path-to-regexp 该工具库用来处理 url 中地址与参数
    // 根据路径填充参数 返回一个完整的链接
    return filler(params || {}, { pretty: true })
  } catch (e) {
    // 这个第三方库在缺失参数的时候 可能会抛出异常
    if (process.env.NODE_ENV !== 'production') {
      warn(false, `missing param for ${routeMsg}: ${e.message}`)
    }
    return ''
  }
}
