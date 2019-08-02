/* @flow */

import type VueRouter from '../index'
import { stringifyQuery } from './query'

const trailingSlashRE = /\/?$/

// 创建一个route对象
export function createRoute (
  record: ?RouteRecord,
  location: Location,
  redirectedFrom?: ?Location,
  router?: VueRouter
): Route {
  const stringifyQuery = router && router.options.stringifyQuery

  // 获取到query没有就用空对象
  let query: any = location.query || {}
  try {
    // 把query复制一份 后面改动不会影响原来的
    query = clone(query)
  } catch (e) {}

  // 构造一个对象
  const route: Route = {
    name: location.name || (record && record.name),
    meta: (record && record.meta) || {},
    path: location.path || '/',
    hash: location.hash || '',
    query,
    params: location.params || {},
    fullPath: getFullPath(location, stringifyQuery),  // 把对象转换成query path字符串
    matched: record ? formatMatch(record) : []  // 找到所有的父级 以及当前record
  }
  if (redirectedFrom) {
    // 来源页
    route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
  }
  // 防止外部修改
  return Object.freeze(route)
}

// 复制一个对象 一个数组
function clone (value) {
  if (Array.isArray(value)) {
    // 调用map重新生成一个数组
    return value.map(clone)
  } else if (value && typeof value === 'object') {
    // 是个对象的话就for in重新对一个对象赋值
    const res = {}
    for (const key in value) {
      // 不管是不是复杂数据类型都递归调用
      res[key] = clone(value[key])
    }
    return res
  } else {
    return value
  }
}

// the starting route that represents the initial state
// 开始的路由路径为 /
export const START = createRoute(null, {
  path: '/'
})

// 当前路径匹配到的所有record
function formatMatch (record: ?RouteRecord): Array<RouteRecord> {
  const res = []
  // 一直找parent 直到为空 所有父级
  while (record) {
    // 全部放进数组中返回
    res.unshift(record)
    record = record.parent
  }
  return res
}

// 获取完整路径
function getFullPath (
  { path, query = {}, hash = '' },
  _stringifyQuery
): string {
  // 对象转换成path字符串 有配置的用配置的 没有用默认的
  const stringify = _stringifyQuery || stringifyQuery
  // 转换一下拼上path 和 hash
  return (path || '/') + stringify(query) + hash
}

// 是否是同一个路由
export function isSameRoute (a: Route, b: ?Route): boolean {
  if (b === START) {
    return a === b
  } else if (!b) {
    return false
  } else if (a.path && b.path) {
    // 都有path
    // 判断 path hash query是否相同
    return (
      a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query)
    )
  } else if (a.name && b.name) {
    // 都有name
    // 判断 name hash query params是否相同
    return (
      a.name === b.name &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query) &&
      isObjectEqual(a.params, b.params)
    )
  } else {
    return false
  }
}

// 判断两个对象是否相同
function isObjectEqual (a = {}, b = {}): boolean {
  // handle null value #1566
  // 有一个为空的时候 直接判断 除非两个都是空
  if (!a || !b) return a === b
  // 拿到所有的key
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  // key的个数是否相同
  if (aKeys.length !== bKeys.length) {
    return false
  }
  // 遍历其中一个
  return aKeys.every(key => {
    // 拿到对应的值
    const aVal = a[key]
    const bVal = b[key]
    // check nested equality
    // 两个都是对象 的时候递归调用
    if (typeof aVal === 'object' && typeof bVal === 'object') {
      return isObjectEqual(aVal, bVal)
    }
    // 不是对象 转换成字符串比较
    return String(aVal) === String(bVal)
  })
}

// current大 target小
export function isIncludedRoute (current: Route, target: Route): boolean {
  return (
// query也要包含target
    current.path.replace(trailingSlashRE, '/').indexOf(
      target.path.replace(trailingSlashRE, '/')
    ) === 0 &&
    // hash要么 没有要么相等
    (!target.hash || current.hash === target.hash) &&
    // path要以target的开头
    queryIncludes(current.query, target.query)
  )
}

// target中的每一项是否全部包含在current中
// current大 target小
function queryIncludes (current: Dictionary<string>, target: Dictionary<string>): boolean {
  for (const key in target) {
    if (!(key in current)) {
      return false
    }
  }
  return true
}
