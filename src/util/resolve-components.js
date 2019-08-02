/* @flow */

import { _Vue } from '../install'
import { warn, isError } from './warn'

// 路由对应的组件是异步组件
export function resolveAsyncComponents (matched: Array<RouteRecord>): Function {
  return (to, from, next) => {
    let hasAsync = false
    let pending = 0
    let error = null

    flatMapComponents(matched, (def, _, match, key) => {
      // if it's a function and doesn't have cid attached,
      // assume it's an async component resolve function.
      // we are not using Vue's default async resolving mechanism because
      // we want to halt the navigation until the incoming component has been
      // resolved.

      // def是一个函数  没有cid  就是异步组件
      if (typeof def === 'function' && def.cid === undefined) {
        hasAsync = true
        // 计数
        pending++

        // resolve reject保证只执行一次
        const resolve = once(resolvedDef => {
          // esmodule的时候 默认输出的是default字段 重新赋值
          if (isESModule(resolvedDef)) {
            resolvedDef = resolvedDef.default
          }
          // save resolved on async factory in case it's used elsewhere
          def.resolved = typeof resolvedDef === 'function'
            ? resolvedDef
            : _Vue.extend(resolvedDef)
          // 当加载完成的时候 赋值给components
          match.components[key] = resolvedDef
          // 完成的时候 就恢复计数器
          pending--
          // 全部完成的时候 调用next 好让队列继续
          if (pending <= 0) {
            next()
          }
        })

        const reject = once(reason => {
          const msg = `Failed to resolve async component ${key}: ${reason}`
          process.env.NODE_ENV !== 'production' && warn(false, msg)
          if (!error) {
            // reject 抛出的是否是个错误 也可能人为抛出string
            error = isError(reason)
              ? reason
              : new Error(msg)
            // 调用next 好让队列继续
            next(error)
          }
        })

        let res
        try {
          // 一次调用 传入的是resolve, reject  可以在方法内部调用
          res = def(resolve, reject)
        } catch (e) {
          reject(e)
        }
        if (res) {
          if (typeof res.then === 'function') {
            res.then(resolve, reject)
          } else {
            // new syntax in Vue 2.3
            const comp = res.component
            if (comp && typeof comp.then === 'function') {
              comp.then(resolve, reject)
            }
          }
        }
      }
    })

    // 第二次走这里的时候 或者不是异步组件的时候
    if (!hasAsync) next()
  }
}

// matched传入的是一个record数组
export function flatMapComponents (
  matched: Array<RouteRecord>,
  fn: Function
): Array<?Function> {
  // 遍历record数组 获取没一项的对应组件
  // 调用concat 把数组拍平成一维数组
  // 两个map的返回值 组成的二位数组 要拍平一次
  return flatten(matched.map(m => {
    // key就是每个组件名
    // 用户输入的components 或者 默认生成的components 遍历一波 然后取出数据 当做fn的参数调用
    return Object.keys(m.components).map(key => fn(
      //  组件构造函数
      m.components[key],
      // 组件实例
      m.instances[key],
      // record
      m,
        // 组件名（路由的component 默认defalut）
        key
    ))
  }))
}

// 调用concat 然后把传入的数组拍平
export function flatten (arr: Array<any>): Array<any> {
  return Array.prototype.concat.apply([], arr)
}

// 判断浏览器是否支持Symbol
const hasSymbol =
  typeof Symbol === 'function' &&
  typeof Symbol.toStringTag === 'symbol'

function isESModule (obj) {
  return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === 'Module')
}

// in Webpack 2, require.ensure now also returns a Promise
// so the resolve/reject functions may get called an extra time
// if the user uses an arrow function shorthand that happens to
// return that Promise.
// 传入一个函数 返回一个函数，返回的函数被调用多次 能保证传入的函数只执行一次
function once (fn) {
  // 标记位
  let called = false
  return function (...args) {
    // 先检查标记
    if (called) return
    called = true
    // 调用函数
    return fn.apply(this, args)
  }
}
