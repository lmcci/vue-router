/* @flow */

import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'

// 传入了路由表
export function createRouteMap (
  routes: Array<RouteConfig>,
  oldPathList?: Array<string>,
  oldPathMap?: Dictionary<RouteRecord>,
  oldNameMap?: Dictionary<RouteRecord>
): {
  pathList: Array<string>;
  pathMap: Dictionary<RouteRecord>;
  nameMap: Dictionary<RouteRecord>;
} {

  // 传入的参数优先 （动态添加的时候）  没有就用默认值空的对象数组
  // 所有path字符串 组成的数组
  // the path list is used to control path matching priority
  const pathList: Array<string> = oldPathList || []
  // $flow-disable-line
  // 所有path作为键  record作为值的对象
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
  // $flow-disable-line
  // 所有name作为键  record作为值的对象
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)

  // 遍历路由表
  routes.forEach(route => {
    // 把内容都放在 pathList  pathMap   nameMap 中
    addRouteRecord(pathList, pathMap, nameMap, route)
  })

  // ensure wildcard routes are always at the end
  // 遍历所有的path
  for (let i = 0, l = pathList.length; i < l; i++) {
    // 如果是通配符
    // 就把他放在 最后面
    // 他的优先级最低
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      l--
      i--
    }
  }

  // 组成对象返回
  return {
    pathList,
    pathMap,
    nameMap
  }
}

function addRouteRecord (
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>,
  route: RouteConfig,
  parent?: RouteRecord,
  matchAs?: string
) {
  // route就是路由表中的每一项  拿到path  name
  const { path, name } = route

  // path不能为空
  // component 不能是字符串 （模版）
  if (process.env.NODE_ENV !== 'production') {
    assert(path != null, `"path" is required in a route configuration.`)
    assert(
      typeof route.component !== 'string',
      `route config "component" for path: ${String(path || name)} cannot be a ` +
      `string id. Use an actual component instead.`
    )
  }

  // 用户设置的路径正则配置 没有设置就用空的
  const pathToRegexpOptions: PathToRegexpOptions = route.pathToRegexpOptions || {}

  // 对子路由计算 拼接父路由路径和子路由路径
  // 非子路有就是当前的path
  const normalizedPath = normalizePath(
    path,
    parent,
    pathToRegexpOptions.strict
  )

  // 路由路径是否是大小写敏感  给他放在选项中取
  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  // 定义一个对象 用作记录  后面操作都是给予这个对象 添加到list map中的
  // 大部分属性都是对 路由表选项的一个封装
  const record: RouteRecord = {
    // 当前的路径
    path: normalizedPath,
    // :foo 这种路径匹配正则
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
    // 路径对应的组件
    // 就算传的是component 最后也是要构造一个对象 当做components用
    components: route.components || { default: route.component },
    // 组件的实例
    instances: {},
    // 路由表配置的
    name,
    // 下面都是参数传入的
    parent,
    matchAs,
    redirect: route.redirect,
    beforeEnter: route.beforeEnter,
    meta: route.meta || {},
    props: route.props == null
      ? {}
      : route.components
        ? route.props
        : { default: route.props }
  }

  // 子路由的时候
  if (route.children) {
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    // 子路由的path 有以 / 开头的
    if (process.env.NODE_ENV !== 'production') {
      if (route.name && !route.redirect && route.children.some(child => /^\/?$/.test(child.path))) {
        warn(
          false,
          `Named Route '${route.name}' has a default child route. ` +
          `When navigating to this named route (:to="{name: '${route.name}'"), ` +
          `the default child route will not be rendered. Remove the name from ` +
          `this route and use the name of the default child route for named ` +
          `links instead.`
        )
      }
    }

    // 遍历所有的子路有
    route.children.forEach(child => {
      // childMatchAs 用于拼接子路有的路径
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
      // 递归调用addRouteRecord  其中把当前的record当做父路由参数传入
      // 也会把记录放在 pathList, pathMap, nameMap 中
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
  }

  // 设置了别名 可以通过别名跳转
  if (route.alias !== undefined) {
    // 可以设置多个别名
    // 不是数组就组成数组 赋值给aliases
    const aliases = Array.isArray(route.alias)
      ? route.alias
      : [route.alias]

    // 遍历别名数组
    aliases.forEach(alias => {
      // 把别名当成路径 组成一个路由表的记录 route
      // 有children也传入
      const aliasRoute = {
        path: alias,
        children: route.children
      }

      // 同样要添加到记录中  pathList pathMap nameMap
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || '/' // matchAs
      )
    })
  }

  // 如果当前路径在 map中不存在
  if (!pathMap[record.path]) {
    // 把当前path添加到list中
    pathList.push(record.path)
    // 当前的path作为键 record对象作为值 添加到map中
    pathMap[record.path] = record
  }

  // 命名路由 多生成nameMap
  if (name) {
    // 如果map中没有 就添加进map
    if (!nameMap[name]) {
      // 当前的name作为键  record作为值
      nameMap[name] = record
    } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
      warn(
        false,
        `Duplicate named routes definition: ` +
        `{ name: "${name}", path: "${record.path}" }`
      )
    }
  }
}

// /：foo * 匹配
function compileRouteRegex (path: string, pathToRegexpOptions: PathToRegexpOptions): RouteRegExp {
  // path-to-regexp
  // path A string, array of strings, or a regular expression
  // keys An array to populate with keys found in the path. 这里是空
  // 选项 sensitive strict end start delimiter endsWith whitelist
  const regex = Regexp(path, [], pathToRegexpOptions)
  if (process.env.NODE_ENV !== 'production') {
    const keys: any = Object.create(null)
    regex.keys.forEach(key => {
      warn(!keys[key.name], `Duplicate param keys in route with path: "${path}"`)
      keys[key.name] = true
    })
  }
  return regex
}

// 序列化path
// 父路由的path和path拼接
function normalizePath (path: string, parent?: RouteRecord, strict?: boolean): string {
  // 结尾如果有 /  就替换成空
  if (!strict) path = path.replace(/\/$/, '')
  // 第一个字符是 /  就直接返回
  if (path[0] === '/') return path
  // 如果没有父路由 直接返回
  if (parent == null) return path
  // 拼接父路由的路径 和 当前的路径 作为参数调用cleanPath
  // 替换 双斜杠（//）为单斜杠（/）
  return cleanPath(`${parent.path}/${path}`)
}
