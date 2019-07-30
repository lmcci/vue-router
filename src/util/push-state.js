/* @flow */

import { inBrowser } from './dom'
import { saveScrollPosition } from './scroll'

// 判断浏览器是否支持pushState方法
export const supportsPushState = inBrowser && (function () {
  const ua = window.navigator.userAgent

  // 这些浏览器都支持
  if (
    (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
    ua.indexOf('Mobile Safari') !== -1 &&
    ua.indexOf('Chrome') === -1 &&
    ua.indexOf('Windows Phone') === -1
  ) {
    return false
  }

  // in 判断是否存在
  return window.history && 'pushState' in window.history
})()

// use User Timing api (if present) for more accurate key precision
const Time = inBrowser && window.performance && window.performance.now
  ? window.performance
  : Date

let _key: string = genKey()

// 获取时间 当成key
function genKey (): string {
  return Time.now().toFixed(3)
}

export function getStateKey () {
  return _key
}

export function setStateKey (key: string) {
  _key = key
}

export function pushState (url?: string, replace?: boolean) {
  // 保留当前的滚动位置
  saveScrollPosition()
  // try...catch the pushState call to get around Safari
  // DOM Exception 18 where it limits to 100 pushState calls
  const history = window.history
  try {
    // replace 还是 push
    if (replace) {
      history.replaceState({ key: _key }, '', url)
    } else {
      _key = genKey()
      history.pushState({ key: _key }, '', url)
    }
  } catch (e) {
    window.location[replace ? 'replace' : 'assign'](url)
  }
}

export function replaceState (url?: string) {
  pushState(url, true)
}
