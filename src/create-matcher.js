/* @flow */

import type VueRouter from './index'
import { resolvePath } from './util/path'
import { assert, warn } from './util/warn'
import { createRoute } from './util/route'
import { fillParams } from './util/params'
import { createRouteMap } from './create-route-map'
import { normalizeLocation } from './util/location'

// flow定义的一个类型
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
  // 计算出新的路径  然后根据路径生成一个route对象
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
      // 处理参数
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

      // 命名路由创建router
      if (record) {
        location.path = fillParams(record.path, location.params, `named route "${name}"`)
        return _createRoute(record, location, redirectedFrom)
      }
    } else if (location.path) {
      location.params = {}
      // 遍历所有的path 从而取到所有的record
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i]
        // 取到每个对应的record
        const record = pathMap[path]
        // 看上面生成的新的path和 当前遍历到的正则是否能够匹配
        if (matchRoute(record.regex, location.path, location.params)) {
          // 匹配成功就创建新的路由
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

  // 创建路由对象
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
    match,    // 根据现有的和传入的生成一个新的路径 然后再生成一个路由
    addRoutes   // 外部动态添加路由
  }
}

// regex是上面调用第三方库生成的正则
// 当前路由和正则是否能够匹配
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

  // 所有的匹配成功结果 遍历一次
  // 把匹配结果放在params中
  for (let i = 1, len = m.length; i < len; ++i) {
    const key = regex.keys[i - 1]
    const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
    if (key) {
      params[key.name] = val
    }
  }

  return true
}

// 根据record计算出相对路径  返回一个path
function resolveRecordPath (path: string, record: RouteRecord): string {
  // 有父路由就传父路由的path  没有就以根路径为base
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}
