/* @flow */

export function assert (condition: any, message: string) {
  // 条件如果不成立  就抛出一个错误
  if (!condition) {
    throw new Error(`[vue-router] ${message}`)
  }
}

export function warn (condition: any, message: string) {
  // 非生产环境 条件不成立 有console就输出警告
  if (process.env.NODE_ENV !== 'production' && !condition) {
    typeof console !== 'undefined' && console.warn(`[vue-router] ${message}`)
  }
}

export function isError (err: any): boolean {
  // 判断一个对象是否是Error
  return Object.prototype.toString.call(err).indexOf('Error') > -1
}
