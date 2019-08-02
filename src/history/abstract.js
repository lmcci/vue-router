/* @flow */

import type Router from '../index'
import { History } from './base'

export class AbstractHistory extends History {
  index: number;
  stack: Array<Route>;

  constructor (router: Router, base: ?string) {
    super(router, base)
    this.stack = []
    this.index = -1
  }

  // 添加
  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.transitionTo(location, route => {
      // 跳转完成之后
      // stack有可能当前之后的还有数据（go 只是改索引 没有改stack） push之后就把其他数据直接删了  然后继续添加
      this.stack = this.stack.slice(0, this.index + 1).concat(route)
      // 更新索引
      this.index++
      // 完成的回调
      onComplete && onComplete(route)
    }, onAbort)
  }

  // 替换
  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.transitionTo(location, route => {
      // 和push类似 只是把索引少加了一个
      this.stack = this.stack.slice(0, this.index).concat(route)
      onComplete && onComplete(route)
    }, onAbort)
  }

  // 跳转
  go (n: number) {
    // 判断是否合法
    const targetIndex = this.index + n
    if (targetIndex < 0 || targetIndex >= this.stack.length) {
      return
    }
    // 取出对应的路由
    const route = this.stack[targetIndex]
    // 跳转
    this.confirmTransition(route, () => {
      // 跳转完成之后 更新index
      this.index = targetIndex
      // 调用base的更新
      this.updateRoute(route)
    })
  }

  // 获得当前的路径
  getCurrentLocation () {
    // 从栈顶中取出
    const current = this.stack[this.stack.length - 1]
    // 如果有 就返回完整路径
    return current ? current.fullPath : '/'
  }

  ensureURL () {
    // noop
  }
}
