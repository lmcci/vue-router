/* @flow */

import type Router from '../index'
import { assert } from './warn'
import { getStateKey, setStateKey } from './push-state'

// 一个对象记录滚动位置 以每一个路由生成的_key作为键存储的
const positionStore = Object.create(null)

export function setupScroll () {
  // Fix for #1585 for Firefox
  //
  window.history.replaceState({ key: getStateKey() }, '')
  window.addEventListener('popstate', e => {
    // 当浏览器回退的时候
    // 保存一下滚动位置
    saveScrollPosition()
    // 获取上一次的key set改变
    if (e.state && e.state.key) {
      setStateKey(e.state.key)
    }
  })
}

export function handleScroll (
  router: Router,
  to: Route,
  from: Route,
  isPop: boolean
) {
  if (!router.app) {
    return
  }

  // 路由设置项
  const behavior = router.options.scrollBehavior
  if (!behavior) {
    return
  }

  // 如果不是一个函数 就抛错
  if (process.env.NODE_ENV !== 'production') {
    assert(typeof behavior === 'function', `scrollBehavior must be a function`)
  }

  // wait until re-render finishes before scrolling
  router.app.$nextTick(() => {
    // 先获取上次的滚动位置 key已经改变了
    const position = getScrollPosition()
    // 调用设置的方法 看返回值
    const shouldScroll = behavior(to, from, isPop ? position : null)

    // 返回的是false就什么都不做
    if (!shouldScroll) {
      return
    }

    if (typeof shouldScroll.then === 'function') {
      // 如果是promise方式
      shouldScroll.then(shouldScroll => {
        // 完成的时候滚动
        scrollToPosition((shouldScroll: any), position)
      }).catch(err => {
        if (process.env.NODE_ENV !== 'production') {
          assert(false, err.toString())
        }
      })
    } else {
      // 直接滚动
      scrollToPosition(shouldScroll, position)
    }
  })
}

// 存储当前的滚动位置
export function saveScrollPosition () {
  // 当前路由的key
  const key = getStateKey()
  if (key) {
    // 存一下
    positionStore[key] = {
      x: window.pageXOffset,
      y: window.pageYOffset
    }
  }
}

// 直接通过路由的key 从对象里面取 返回的是一个对象 {x:0, y:0}
function getScrollPosition (): ?Object {
  const key = getStateKey()
  if (key) {
    return positionStore[key]
  }
}

// 获取对应dom元素的位置
function getElementPosition (el: Element, offset: Object): Object {
  const docEl: any = document.documentElement
  const docRect = docEl.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  // 元素相对于 整个文档的距离 在减去偏移量
  return {
    x: elRect.left - docRect.left - offset.x,
    y: elRect.top - docRect.top - offset.y
  }
}

// 是否是一个可用的定位对象  其中x,y有一个是数字就可以
function isValidPosition (obj: Object): boolean {
  return isNumber(obj.x) || isNumber(obj.y)
}

// 序列化位置对象  x,y 有值就用 没值就取window下的页面滚动除去的距离 文档到窗口的距离
function normalizePosition (obj: Object): Object {
  return {
    x: isNumber(obj.x) ? obj.x : window.pageXOffset,
    y: isNumber(obj.y) ? obj.y : window.pageYOffset
  }
}

// 偏移量
function normalizeOffset (obj: Object): Object {
  return {
    // 是数字就用 不是数字就置为0
    x: isNumber(obj.x) ? obj.x : 0,
    y: isNumber(obj.y) ? obj.y : 0
  }
}

// 判断传入的参数是否是数字类型
function isNumber (v: any): boolean {
  return typeof v === 'number'
}

// 滚动到制定位置
function scrollToPosition (shouldScroll, position) {
  const isObject = typeof shouldScroll === 'object'
  if (isObject && typeof shouldScroll.selector === 'string') {
    // 有传入的选择器
    const el = document.querySelector(shouldScroll.selector)
    if (el) {
      // 还可以传入滚动的偏移量
      let offset = shouldScroll.offset && typeof shouldScroll.offset === 'object' ? shouldScroll.offset : {}
      offset = normalizeOffset(offset)
      // 元素相对于文档的位置 在加上偏移量的计算结果
      position = getElementPosition(el, offset)
    } else if (isValidPosition(shouldScroll)) {
      position = normalizePosition(shouldScroll)
    }
  } else if (isObject && isValidPosition(shouldScroll)) {
    // shouldScroll是一个对象 并且包含 x,y
    position = normalizePosition(shouldScroll)
  }

  if (position) {
    // 这里是直接调用window 如果里面再包了一层 就不管用了
    window.scrollTo(position.x, position.y)
  }
}
