/* @flow */

import { _Vue } from '../install'
import type Router from '../index'
import { inBrowser } from '../util/dom'
import { runQueue } from '../util/async'
import { warn, isError } from '../util/warn'
import { START, isSameRoute } from '../util/route'
import {
  flatten,
  flatMapComponents,
  resolveAsyncComponents
} from '../util/resolve-components'

// 其他几个history都继承这个类 所有能够对外提供相同的api
export class History {
  router: Router;
  base: string;
  current: Route;
  pending: ?Route;
  cb: (r: Route) => void;
  ready: boolean;
  readyCbs: Array<Function>;
  readyErrorCbs: Array<Function>;
  errorCbs: Array<Function>;

  // implemented by sub-classes
  +go: (n: number) => void;
  +push: (loc: RawLocation) => void;
  +replace: (loc: RawLocation) => void;
  +ensureURL: (push?: boolean) => void;
  +getCurrentLocation: () => string;

  constructor (router: Router, base: ?string) {
    this.router = router
    this.base = normalizeBase(base)
    // start with a route object that stands for "nowhere"
    this.current = START
    this.pending = null
    this.ready = false
    this.readyCbs = []
    this.readyErrorCbs = []
    this.errorCbs = []
  }

  listen (cb: Function) {
    this.cb = cb
  }

  onReady (cb: Function, errorCb: ?Function) {
    if (this.ready) {
      cb()
    } else {
      this.readyCbs.push(cb)
      if (errorCb) {
        this.readyErrorCbs.push(errorCb)
      }
    }
  }

  onError (errorCb: Function) {
    this.errorCbs.push(errorCb)
  }

  // 重要方法
  // 跳转到一个地址location
  // 成功的回调onComplete
  // 失败的回调onAbort
  transitionTo (location: RawLocation, onComplete?: Function, onAbort?: Function) {

    // this.current 就是当前的route  切换到新的地址 this.current就是新的route

    // 根据目标地址 和 当前地址 计算出一个新的路由
    // 无论是否匹配成功都会返回一个route对象
    const route = this.router.match(location, this.current)

    // 路径切换
    this.confirmTransition(route, () => {
      // 成功回调
      this.updateRoute(route)
      onComplete && onComplete(route)
      this.ensureURL()

      // fire ready cbs once
      if (!this.ready) {
        this.ready = true
        this.readyCbs.forEach(cb => { cb(route) })
      }
    }, err => {
      // 失败回调
      if (onAbort) {
        onAbort(err)
      }
      if (err && !this.ready) {
        this.ready = true
        this.readyErrorCbs.forEach(cb => { cb(err) })
      }
    })
  }

  confirmTransition (route: Route, onComplete: Function, onAbort?: Function) {
    // current就是当前的路径  切换成功的时候会改变这个值
    const current = this.current
    // 对传入的失败回调再封装一层
    const abort = err => {
      // 输出一些错误信息 错误回调队列的执行
      if (isError(err)) {
        if (this.errorCbs.length) {
          this.errorCbs.forEach(cb => { cb(err) })
        } else {
          warn(false, 'uncaught error during route navigation:')
          console.error(err)
        }
      }
      onAbort && onAbort(err)
    }

    // 当前路径和目标路径是否是同一个
    if (
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
      route.matched.length === current.matched.length
    ) {
      // 路径相同就没有必要切换
      // url变化
      this.ensureURL()
      // 直接取消
      return abort()
    }

    // 当前路径的record包含parent  目标路径的record包含parent
    // updated
    // deactivated
    // activated
    // 上面这三个都是record  哪些需要新建 哪些需要销毁 哪些需要更新
    const {
      updated,
      deactivated,
      activated
    } = resolveQueue(this.current.matched, route.matched)

    // 定义一个队列 NavigationGuard就是一个函数
    // to from next
    const queue: Array<?NavigationGuard> = [].concat(
      // in-component leave guards
      //  销毁的 beforeRouteLeave
      extractLeaveGuards(deactivated),
      // global before hooks
      // 用户定义的 beforeEach
      this.router.beforeHooks,
      // in-component update hooks
      //  更新的 beforeRouteUpdate
      extractUpdateHooks(updated),
      // in-config enter guards
      //  新的要激活的路由 路由表中定义的 把所有的beforeEnter获取出来 新建的
      activated.map(m => m.beforeEnter),
      // async components
      //  异步组件 新的要激活的路由
      resolveAsyncComponents(activated)
    )

    this.pending = route
    // 执行runQueue的时候 其实执行的是这个函数
    // 传入的参数是当前遍历到的queue中的一项   next是一个回调 当执行的时候才继续执行queue中的下一项
    const iterator = (hook: NavigationGuard, next) => {
      if (this.pending !== route) {
        return abort()
      }
      try {
        // 调用对应的钩子 传入route当做to, current当做from 还有一个方法 当做next
        hook(route, current, (to: any) => {
          if (to === false || isError(to)) {
            // next(false) -> abort navigation, ensure current URL
            this.ensureURL(true)
            abort(to)
          } else if (
            typeof to === 'string' ||
            (typeof to === 'object' && (
              typeof to.path === 'string' ||
              typeof to.name === 'string'
            ))
          ) {
            // next('/') or next({ path: '/' }) -> redirect
            abort()
            if (typeof to === 'object' && to.replace) {
              this.replace(to)
            } else {
              this.push(to)
            }
          } else {
            // confirm transition and pass on the value
            // 正常case 继续queue下一项
            next(to)
          }
        })
      } catch (e) {
        // 抛出异常 就走abort
        abort(e)
      }
    }

    // 执行队列
    // 当队列中的所有项被iterator执行完之后 才执行cb这个回调
    runQueue(queue, iterator, () => {
      const postEnterCbs = []
      const isValid = () => this.current === route
      // wait until async components are resolved before
      // extracting in-component enter guards

      // 上一个队列执行完毕后 再构建一个队列 继续执行
      // beforeRouteEnter
      const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid)
      // 用户设置的beforeResolve beforeHooks
      const queue = enterGuards.concat(this.router.resolveHooks)
      runQueue(queue, iterator, () => {
        if (this.pending !== route) {
          return abort()
        }
        this.pending = null
        // 完成的回调
        onComplete(route)
        if (this.router.app) {
          this.router.app.$nextTick(() => {
            postEnterCbs.forEach(cb => { cb() })
          })
        }
      })
    })
  }

  updateRoute (route: Route) {
    // 替换current 当前的route
    // 记录上一次的route
    const prev = this.current
    this.current = route

    // 调用回调
    this.cb && this.cb(route)

    // 执行afterHooks
    this.router.afterHooks.forEach(hook => {
      hook && hook(route, prev)
    })
  }
}

function normalizeBase (base: ?string): string {
  if (!base) {
    if (inBrowser) {
      // respect <base> tag
      const baseEl = document.querySelector('base')
      base = (baseEl && baseEl.getAttribute('href')) || '/'
      // strip full URL origin
      base = base.replace(/^https?:\/\/[^\/]+/, '')
    } else {
      base = '/'
    }
  }
  // make sure there's the starting slash
  if (base.charAt(0) !== '/') {
    base = '/' + base
  }
  // remove trailing slash
  return base.replace(/\/$/, '')
}

function resolveQueue (
  current: Array<RouteRecord>,
  next: Array<RouteRecord>
): {
  updated: Array<RouteRecord>,
  activated: Array<RouteRecord>,
  deactivated: Array<RouteRecord>
} {
  let i
  // 长度最长的
  const max = Math.max(current.length, next.length)

  // 遍历 获取到i 不相等的索引
  for (i = 0; i < max; i++) {
    if (current[i] !== next[i]) {
      break
    }
  }
  return {
    // 前面有相同的record
    updated: next.slice(0, i),
    // 目标 新的record
    activated: next.slice(i),
    // 当前 剩余的record
    deactivated: current.slice(i)
  }
}

// 解析守卫
function extractGuards (
  records: Array<RouteRecord>,
  name: string,
  bind: Function,
  reverse?: boolean
): Array<?Function> {
  // flatMapComponents 会对传入的每个record 把他的component当做参数调用fn 获得返回值后 拍平成一维数组返回
  const guards = flatMapComponents(records, (def, instance, match, key) => {
    //  组件构造函数
    // 组件实例
    // record
    // 组件名（路由的component 默认defalut）

    // name是参数传入的 beforeRouteLeave 或者 beforeRouteUpdate
    // guard是对应组件的生命周期函数
    const guard = extractGuard(def, name)
    if (guard) {
      return Array.isArray(guard)
        //  是一个数组 就遍历 然后调用bind 把所有返回值 组成数组
        //  bind是为了执行生命周期的时候绑定一个上下文 传入的instance
        //
        ? guard.map(guard => bind(guard, instance, match, key))
        : bind(guard, instance, match, key)
    }
  })

  // 最后一个参数是否要调换数组的顺序 生命周期执行顺序
  return flatten(reverse ? guards.reverse() : guards)
}

function extractGuard (
  def: Object | Function,
  key: string
): NavigationGuard | Array<NavigationGuard> {
  // 传入的组件不是一个构造函数
  if (typeof def !== 'function') {
    // extend now so that global mixins are applied.
    // 调用extend创建一个构造函数
    def = _Vue.extend(def)
  }
  // 从构造函数中拿到生命周期hook beforeRouteLeave beforeRouteUpdate
  return def.options[key]
}

function extractLeaveGuards (deactivated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

function extractUpdateHooks (updated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

function bindGuard (guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard {
  if (instance) {
    // 返回一个函数 然后执行guard 其实就是每个vue内的路由hook 绑定上下文为vm实例
    return function boundRouteGuard () {
      return guard.apply(instance, arguments)
    }
  }
}

function extractEnterGuards (
  activated: Array<RouteRecord>,
  cbs: Array<Function>,
  isValid: () => boolean
): Array<?Function> {
  // 这里bind方法比较特殊
  // bind是为了执行生命周期的时候改变上下文用的
  // 这里组件还没有实例化 所以用不了this
  // 有next回调函数 可以用this
  return extractGuards(activated, 'beforeRouteEnter', (guard, _, match, key) => {
    return bindEnterGuard(guard, match, key, cbs, isValid)
  })
}

function bindEnterGuard (
  guard: NavigationGuard,
  match: RouteRecord,
  key: string,
  cbs: Array<Function>,
  isValid: () => boolean
): NavigationGuard {
  return function routeEnterGuard (to, from, next) {
    return guard(to, from, cb => {
      next(cb)
      // next 的回调 第一个参数是vm
      if (typeof cb === 'function') {
        cbs.push(() => {
          // #750
          // if a router-view is wrapped with an out-in transition,
          // the instance may not have been registered at this time.
          // we will need to poll for registration until current route
          // is no longer valid.
          // 轮询
          poll(cb, match.instances, key, isValid)
        })
      }
    })
  }
}

// 轮询判断instances有没有
function poll (
  cb: any, // somehow flow cannot infer this is a function
  instances: Object,
  key: string,
  isValid: () => boolean
) {
  // 有的时候直接执行回调
  if (instances[key]) {
    cb(instances[key])
  } else if (isValid()) {
    // isValid 是判断导航是否还是当前的
    // 没有就等16毫秒后继续执行
    setTimeout(() => {
      poll(cb, instances, key, isValid)
    }, 16)
  }
}
