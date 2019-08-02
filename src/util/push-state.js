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
// 浏览器支持程度 优先取window.performance（从页面初始化到调用该方法时的毫秒数 以微秒为单位的时间，更加精准）
// 与Date.now()会受系统程序执行阻塞的影响不同，performance.now()的时间是以恒定速率递增的，不受系统时间的影响(系统时间可被人为或软件调整)
const Time = inBrowser && window.performance && window.performance.now
  ? window.performance
  : Date

// 初始化的时候生成一个唯一key
let _key: string = genKey()

// 获取时间 当成key
function genKey (): string {
  // 转换成字符串保留三位小数
  return Time.now().toFixed(3)
}

export function getStateKey () {
  return _key
}

// 对key做改变 上面get 这里set
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
      // push要重新生成key  作为新页面的标识 后续pop等可以使用
      _key = genKey()
      history.pushState({ key: _key }, '', url)
    }
  } catch (e) {
    // assign 就是href的函数形式
    window.location[replace ? 'replace' : 'assign'](url)
  }
}

// 调用pushState 第二个参数为true就是替换
export function replaceState (url?: string) {
  pushState(url, true)
}
