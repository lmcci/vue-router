/* @flow */

import type VueRouter from './index'
import { resolvePath } from './util/path'
import { assert, warn } from './util/warn'
import { createRoute } from './util/route'
import { fillParams } from './util/params'
import { createRouteMap } from './create-route-map'
import { normalizeLocation } from './util/location'

export type Matcher = {
  match: (raw: RawLocation, current?: Route, redirectedFrom?: Location) => Route;
  addRoutes: (routes: Array<RouteConfig>) => void;
};

// 一个方法  传入了路由表  和  vuerouter实例  返回了一个Matcher  {match,addRoutes}
export function createMatcher (
  routes: Array<RouteConfig>,
  router: VueRouter
): Matcher {
  // 把路由表 生成 list  map 方便后面使用
  const { pathList, pathMap, nameMap } = createRouteMap(routes)

  // 有可能动态添加的路由 所以可以调用方法继续生成映射
  function addRoutes (routes) {
    createRouteMap(routes, pathList, pathMap, nameMap)
  }
  // 后面还有 match  redirect  alias  _createRoute 几个方法

  // 判断是否能够匹配
  function match (
    raw: RawLocation,   // 下一个路由 string | Location
    currentRoute?: Route,  // 当前路由 {path: string;name: ?string;hash: string;query: Dictionary<string>;params: Dictionary<string>;fullPath: string;matched: Array<RouteRecord>;redirectedFrom?: string;meta?: any;}
    redirectedFrom?: Location  //  {_normalized?: boolean;name?: string;path?: string;hash?: string;query?: Dictionary<string>;params?: Dictionary<string>;append?: boolean;replace?: boolean;}
  ): Route {
    // 根据当前路由 和 下一个路由（传入的location）计算出一个新的路径
    const location = normalizeLocation(raw, currentRoute, false, router)
    const { name } = location

    // 是否是命名路由
    if (name) {
      // 从map中直接拿到record对象
      const record = nameMap[name]
      // 如果record不存在就警告
      if (process.env.NODE_ENV !== 'production') {
        warn(record, `Route with name '${name}' does not exist`)
      }
      // 没有record
      // 就创建一个route对象  传入的是null 最后这个route匹配不到组件
      if (!record) return _createRoute(null, location)
      // 有record
      const paramNames = record.regex.keys
        .filter(key => !key.optional)
        .map(key => key.name)

      if (typeof location.params !== 'object') {
        location.params = {}
      }

      if (currentRoute && typeof currentRoute.params === 'object') {
        for (const key in currentRoute.params) {
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            location.params[key] = currentRoute.params[key]
          }
        }
      }

      if (record) {
        location.path = fillParams(record.path, location.params, `named route "${name}"`)
        return _createRoute(record, location, redirectedFrom)
      }
    } else if (location.path) {
      location.params = {}
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i]
        const record = pathMap[path]
        if (matchRoute(record.regex, location.path, location.params)) {
          return _createRoute(record, location, redirectedFrom)
        }
      }
    }
    // no match
    // 都没有匹配上
    // 传入的是null 获得的也是route对象 最后这个route匹配不到组件
    return _createRoute(null, location)
  }

  function redirect (
    record: RouteRecord,
    location: Location
  ): Route {
    const originalRedirect = record.redirect
    let redirect = typeof originalRedirect === 'function'
        ? originalRedirect(createRoute(record, location, null, router))
        : originalRedirect

    if (typeof redirect === 'string') {
      redirect = { path: redirect }
    }

    if (!redirect || typeof redirect !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false, `invalid redirect option: ${JSON.stringify(redirect)}`
        )
      }
      return _createRoute(null, location)
    }

    const re: Object = redirect
    const { name, path } = re
    let { query, hash, params } = location
    query = re.hasOwnProperty('query') ? re.query : query
    hash = re.hasOwnProperty('hash') ? re.hash : hash
    params = re.hasOwnProperty('params') ? re.params : params

    if (name) {
      // resolved named direct
      const targetRecord = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        assert(targetRecord, `redirect failed: named route "${name}" not found.`)
      }
      return match({
        _normalized: true,
        name,
        query,
        hash,
        params
      }, undefined, location)
    } else if (path) {
      // 1. resolve relative redirect
      const rawPath = resolveRecordPath(path, record)
      // 2. resolve params
      const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)
      // 3. rematch with existing query and hash
      return match({
        _normalized: true,
        path: resolvedPath,
        query,
        hash
      }, undefined, location)
    } else {
      if (process.env.NODE_ENV !== 'production') {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
      }
      return _createRoute(null, location)
    }
  }

  function alias (
    record: RouteRecord,
    location: Location,
    matchAs: string
  ): Route {
    const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)
    const aliasedMatch = match({
      _normalized: true,
      path: aliasedPath
    })
    if (aliasedMatch) {
      const matched = aliasedMatch.matched
      const aliasedRecord = matched[matched.length - 1]
      location.params = aliasedMatch.params
      return _createRoute(aliasedRecord, location)
    }
    return _createRoute(null, location)
  }

  function _createRoute (
    record: ?RouteRecord,
    location: Location,
    redirectedFrom?: Location
  ): Route {
    if (record && record.redirect) {
      return redirect(record, redirectedFrom || location)
    }
    if (record && record.matchAs) {
      return alias(record, location, record.matchAs)
    }
    return createRoute(record, location, redirectedFrom, router)
  }

  return {
    match,
    addRoutes
  }
}

function matchRoute (
  regex: RouteRegExp, // 路由匹配的正则
  path: string,
  params: Object
): boolean {
  // 正则match
  const m = path.match(regex)

  // 如果没有匹配成功就返回false
  if (!m) {
    return false
  } else if (!params) {
    // 匹配成功 但是没有参数 返回true
    return true
  }

  //
  for (let i = 1, len = m.length; i < len; ++i) {
    const key = regex.keys[i - 1]
    const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
    if (key) {
      params[key.name] = val
    }
  }

  return true
}

function resolveRecordPath (path: string, record: RouteRecord): string {
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}
