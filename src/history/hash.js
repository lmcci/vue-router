/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { getLocation } from './html5'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HashHistory extends History {
  constructor (router: Router, base: ?string, fallback: boolean) {
    super(router, base)
    // check history fallback deeplinking
    if (fallback && checkFallback(this.base)) {
      return
    }
    // 没有写路径的时候 默认跳转到 #/
    ensureSlash()
  }

  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  // 监听浏览器回退
  setupListeners () {
    const router = this.router
    // 滚动条
    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll

    if (supportsScroll) {
      setupScroll()
    }

    // 设置监听器
    window.addEventListener(supportsPushState ? 'popstate' : 'hashchange', () => {
      //
      const current = this.current
      if (!ensureSlash()) {
        return
      }
      // 执行路径切换
      this.transitionTo(getHash(), route => {
        if (supportsScroll) {
          handleScroll(this.router, route, current, true)
        }
        if (!supportsPushState) {
          replaceHash(route.fullPath)
        }
      })
    })
  }

  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    // 路径切换
    this.transitionTo(location, route => {
      // 切换成功之后

      // 改变hash
      pushHash(route.fullPath)

      // 滚动定位
      handleScroll(this.router, route, fromRoute, false)
      // 完成回调
      onComplete && onComplete(route)
    }, onAbort)
  }

  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      replaceHash(route.fullPath)
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  // bom方法
  go (n: number) {
    window.history.go(n)
  }

  //
  ensureURL (push?: boolean) {
    // 当前的hash 和路径不相等的时候 就跳转到对应的地址
    const current = this.current.fullPath
    if (getHash() !== current) {
      push ? pushHash(current) : replaceHash(current)
    }
  }

  // 直接返回hash值  就是路径
  getCurrentLocation () {
    return getHash()
  }
}

//
function checkFallback (base) {
  // 除去base之后的路径
  const location = getLocation(base)
  // 不以/# 开头 就replace跳转
  // 证明前面除了base还有其他的
  if (!/^\/#/.test(location)) {
    window.location.replace(
      cleanPath(base + '/#' + location)
    )
    return true
  }
}

// 确保有一个斜线
function ensureSlash (): boolean {
  // 获取hash不以/开头 或者为空
  const path = getHash()
  if (path.charAt(0) === '/') {
    return true
  }
  //  添加一个斜线
  replaceHash('/' + path)
  return false
}

// 获得hash路径
export function getHash (): string {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  // 直接截取返回的
  const href = window.location.href
  const index = href.indexOf('#')
  return index === -1 ? '' : href.slice(index + 1)
}

// path 不包含协议 域名 这里调用之后拼接一个完整的返回
function getUrl (path) {
  // 先从当前页面路径中找 到#  如果有就替换后面的  没有就拼接上#hash
  const href = window.location.href
  const i = href.indexOf('#')
  const base = i >= 0 ? href.slice(0, i) : href
  return `${base}#${path}`
}

function pushHash (path) {
  // 是否支持PushState
  if (supportsPushState) {
    // pushState中会记录滚动位置 生成key
    pushState(getUrl(path))
  } else {
    // 不支持的话 直接改变hash
    window.location.hash = path
  }
}

function replaceHash (path) {
  // 是否支持PushState
  if (supportsPushState) {
    replaceState(getUrl(path))
  } else {
    // 不支持的话 直接replace跳转
    window.location.replace(getUrl(path))
  }
}
