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
    fullPath: getFullPath(location, stringifyQuery),
    matched: record ? formatMatch(record) : []
  }
  if (redirectedFrom) {
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
export const START = createRoute(null, {
  path: '/'
})

// 当前路径匹配到的所有record
function formatMatch (record: ?RouteRecord): Array<RouteRecord> {
  const res = []
  // 一直找parent 直到为空
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
  const stringify = _stringifyQuery || stringifyQuery
  return (path || '/') + stringify(query) + hash
}

export function isSameRoute (a: Route, b: ?Route): boolean {
  if (b === START) {
    return a === b
  } else if (!b) {
    return false
  } else if (a.path && b.path) {
    // 都有path
    return (
      a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query)
    )
  } else if (a.name && b.name) {
    // 都有name
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

function isObjectEqual (a = {}, b = {}): boolean {
  // handle null value #1566
  if (!a || !b) return a === b
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every(key => {
    const aVal = a[key]
    const bVal = b[key]
    // check nested equality
    if (typeof aVal === 'object' && typeof bVal === 'object') {
      return isObjectEqual(aVal, bVal)
    }
    return String(aVal) === String(bVal)
  })
}

export function isIncludedRoute (current: Route, target: Route): boolean {
  return (
    current.path.replace(trailingSlashRE, '/').indexOf(
      target.path.replace(trailingSlashRE, '/')
    ) === 0 &&
    (!target.hash || current.hash === target.hash) &&
    queryIncludes(current.query, target.query)
  )
}

function queryIncludes (current: Dictionary<string>, target: Dictionary<string>): boolean {
  for (const key in target) {
    if (!(key in current)) {
      return false
    }
  }
  return true
}
