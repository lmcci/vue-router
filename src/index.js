/* @flow */

import { install } from './install'
import { START } from './util/route'
import { assert } from './util/warn'
import { inBrowser } from './util/dom'
import { cleanPath } from './util/path'
import { createMatcher } from './create-matcher'
import { normalizeLocation } from './util/location'
import { supportsPushState } from './util/push-state'

import { HashHistory } from './history/hash'
import { HTML5History } from './history/html5'
import { AbstractHistory } from './history/abstract'

import type { Matcher } from './create-matcher'

// 入口
// 输出一个class
export default class VueRouter {
  static install: () => void;
  static version: string;

  app: any;
  apps: Array<any>;
  ready: boolean;
  readyCbs: Array<Function>;
  options: RouterOptions;
  mode: string;
  history: HashHistory | HTML5History | AbstractHistory;
  matcher: Matcher;
  fallback: boolean;
  beforeHooks: Array<?NavigationGuard>;
  resolveHooks: Array<?NavigationGuard>;
  afterHooks: Array<?AfterNavigationHook>;

  constructor (options: RouterOptions = {}) {
    this.app = null
    this.apps = []
    this.options = options
    this.beforeHooks = []
    this.resolveHooks = []
    this.afterHooks = []
    // 传入的是路由表   路径对应组件的映射数组  this就是vuerouter的实例
    this.matcher = createMatcher(options.routes || [], this)

    // 路由的模式 默认hash
    let mode = options.mode || 'hash'

    // 如果配置了history模式 并且浏览器不支持PushState  允许用兜底策略 就改用hash
    this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false
    if (this.fallback) {
      mode = 'hash'
    }
    // 非浏览器才用 抽象模式
    if (!inBrowser) {
      mode = 'abstract'
    }
    this.mode = mode


    // 实例化不同的history  他们实现了相同的api
    switch (mode) {
      case 'history':
        this.history = new HTML5History(this, options.base)
        break
      case 'hash':
        this.history = new HashHistory(this, options.base, this.fallback)
        break
      case 'abstract':
        this.history = new AbstractHistory(this, options.base)
        break
      default:
        // 选项中设置了 其他的模式  可能单词拼写错误、、、
        if (process.env.NODE_ENV !== 'production') {
          assert(false, `invalid mode: ${mode}`)
        }
    }
  }

  // 每当调用history的transitionTo都会调用这里的match方法
  match (
    raw: RawLocation,
    current?: Route,
    redirectedFrom?: Location
  ): Route {
    // 调用matcher的方法
    // matcher在构造函数中赋值的
    return this.matcher.match(raw, current, redirectedFrom)
  }

  get currentRoute (): ?Route {
    return this.history && this.history.current
  }

  // 对外暴露install方法的里面 通过mixin注入类beforeCreate方法中 有判断
  // 当根Vue实例走到beforeCreate的时候会执行 vuerouter实例的init
  init (app: any /* Vue component instance */) {
    // 传入的app是根Vue实例 vm
    process.env.NODE_ENV !== 'production' && assert(
      install.installed,
      `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
      `before creating root instance.`
    )

    // apps里面记录了 vue组件实例对象
    this.apps.push(app)

    // main app already initialized.
    // 确保只执行一次
    if (this.app) {
      return
    }

    // 记录根vm
    this.app = app

    const history = this.history

    if (history instanceof HTML5History) {
      // history模式

      // 路径切换
      history.transitionTo(history.getCurrentLocation())
    } else if (history instanceof HashHistory) {
      // hash模式

      const setupHashListener = () => {
        // 当浏览器回退的时候
        history.setupListeners()
      }
      // 路径切换
      history.transitionTo(
        history.getCurrentLocation(),
        // 成功和失败的会调都走一次setupHashListener
        setupHashListener,
        setupHashListener
      )
    }

    // 路径监听
    history.listen(route => {
      this.apps.forEach((app) => {
        app._route = route
      })
    })
  }

  // router的实例方法

  // 调用添加 hook方法
  beforeEach (fn: Function): Function {
    // 会把fn 添加到beforeHooks 数组中
    return registerHook(this.beforeHooks, fn)
  }

  beforeResolve (fn: Function): Function {
    return registerHook(this.resolveHooks, fn)
  }

  afterEach (fn: Function): Function {
    return registerHook(this.afterHooks, fn)
  }

  onReady (cb: Function, errorCb?: Function) {
    this.history.onReady(cb, errorCb)
  }

  onError (errorCb: Function) {
    this.history.onError(errorCb)
  }

  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.history.push(location, onComplete, onAbort)
  }

  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.history.replace(location, onComplete, onAbort)
  }

  // 最终会调用 history实例的go方法  base中定义 各个history中实现
  go (n: number) {
    this.history.go(n)
  }

  // router.back() 其实就是调用了go
  back () {
    this.go(-1)
  }

  // router.forward() 其实就是调用了go
  forward () {
    this.go(1)
  }

  getMatchedComponents (to?: RawLocation | Route): Array<any> {
    const route: any = to
      ? to.matched
        ? to
        : this.resolve(to).route
      : this.currentRoute
    if (!route) {
      return []
    }
    return [].concat.apply([], route.matched.map(m => {
      return Object.keys(m.components).map(key => {
        return m.components[key]
      })
    }))
  }

  resolve (
    to: RawLocation,
    current?: Route,
    append?: boolean
  ): {
    location: Location,
    route: Route,
    href: string,
    // for backwards compat
    normalizedTo: Location,
    resolved: Route
  } {
    const location = normalizeLocation(
      to,
      current || this.history.current,
      append,
      this
    )
    const route = this.match(location, current)
    const fullPath = route.redirectedFrom || route.fullPath
    const base = this.history.base
    const href = createHref(base, fullPath, this.mode)
    return {
      location,
      route,
      href,
      // for backwards compat
      normalizedTo: location,
      resolved: route
    }
  }

  addRoutes (routes: Array<RouteConfig>) {
    this.matcher.addRoutes(routes)
    if (this.history.current !== START) {
      this.history.transitionTo(this.history.getCurrentLocation())
    }
  }
}

function registerHook (list: Array<any>, fn: Function): Function {
  // 方法添加进数组
  list.push(fn)

  // 返回一个函数  当函数被调用的时候 删除这个hook
  return () => {
    const i = list.indexOf(fn)
    if (i > -1) list.splice(i, 1)
  }
}

function createHref (base: string, fullPath: string, mode) {
  var path = mode === 'hash' ? '#' + fullPath : fullPath
  return base ? cleanPath(base + '/' + path) : path
}

// Vue.use() 就是调用install方法
VueRouter.install = install
VueRouter.version = '__VERSION__'

// 通过script引入的时候 最终也是使用use
if (inBrowser && window.Vue) {
  window.Vue.use(VueRouter)
}
