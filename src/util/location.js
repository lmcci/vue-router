/* @flow */

import type VueRouter from '../index'
import { parsePath, resolvePath } from './path'
import { resolveQuery } from './query'
import { fillParams } from './params'
import { warn } from './warn'

export function normalizeLocation (
  raw: RawLocation,
  current: ?Route,
  append: ?boolean,
  router: ?VueRouter
): Location {
  // 如果是string 就构造一个对象 path的值
  let next: Location = typeof raw === 'string' ? { path: raw } : raw
  // named target
  // 如果有name  或者有已经被序列化的标记_normalized 就直接返回他本身
  if (next.name || next._normalized) {
    return next
  }

  // relative params
  // 下一个路由没有路径只有参数 就拼接参数返回
  // 处理参数
  if (!next.path && next.params && current) {
    // 复制一份
    next = assign({}, next)
    // 设置标记
    next._normalized = true
    // 合并当前路由的参数 和 下个路由的参数
    const params: any = assign(assign({}, current.params), next.params)
    // 当前是命名路由
    if (current.name) {
      // 添加数据
      next.name = current.name
      next.params = params
    } else if (current.matched.length) {
      // 最后一个匹配的路径
      const rawPath = current.matched[current.matched.length - 1].path
      // 拼接当前路径和完整参数 完成路径
      next.path = fillParams(rawPath, params, `path ${current.path}`)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(false, `relative params navigation requires a current route.`)
    }
    return next
  }

  // 根据下一个路由的路径解析出 path query hash 只是简单的截取
  const parsedPath = parsePath(next.path || '')
  // 当前路由的路径
  const basePath = (current && current.path) || '/'
  // 当前的路径 和 传入的路径 计算生成新的path
  // 如果下一个路由的路径上面截取不出来 就直接返回当前path
  const path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append || next.append)
    : basePath

  //
  const query = resolveQuery(
    parsedPath.query,
    next.query,
    router && router.options.parseQuery
  )

  // hash处理 传入的没有就用截取的
  // 不以#开头就添加上
  let hash = next.hash || parsedPath.hash
  if (hash && hash.charAt(0) !== '#') {
    hash = `#${hash}`
  }

  return {
    // 序列化标记
    _normalized: true,
    path,
    query,
    hash
  }
}

// 遍历后面的对象属性 赋值给前面的对象
function assign (a, b) {
  for (const key in b) {
    a[key] = b[key]
  }
  return a
}
