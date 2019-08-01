import View from './components/view'
import Link from './components/link'

export let _Vue

// 调用Vue.use(插件, 参数1, 参数2)  的时候会调用插件的install 方法 传入的第一个参数是Vue 后面是参数1 参数2
export function install (Vue) {
  // 搞一个变量记录 是否已经use过
  if (install.installed && _Vue === Vue) return
  install.installed = true

  // 其他地方也可以用Vue
  _Vue = Vue

  // 判断传入的参数是否是undefined
  // 不是undefined返回true
  const isDef = v => v !== undefined

  const registerInstance = (vm, callVal) => {
    // vm.$options._parentVnode.data.registerRouteInstance() router-view中的
    let i = vm.$options._parentVnode
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }

  // mixin 了两个生命周期
  Vue.mixin({
    beforeCreate () {
      // 判断在new Vue的时候是否传入了VueRouter实例
      // 根Vue实例才走这里
      if (isDef(this.$options.router)) {
        // 根Vue实例 vm
        this._routerRoot = this
        // vue router 的实例  就是通过new VueRouter() 创建的对象
        this._router = this.$options.router
        // 调用实例方法init
        this._router.init(this)
        // 把_route变成响应式的
        // 通过这里真正执行渲染
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {
        // 非根Vue
        // 根据初始化调用的时机 先父后子 所有的组件都能通过 _routerRoot找到根vue实例
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }

      //
      registerInstance(this, this)
    },
    destroyed () {
      registerInstance(this)
    }
  })

  // Vue原型上定义$router
  // 每个实例访问到$router的时候 其实是在访问_routerRoot._router  根vm._router 也就是创建的vuerouter实例
  Object.defineProperty(Vue.prototype, '$router', {
    get () { return this._routerRoot._router }
  })

  // Vue原型上定义$route
  // 每个实例访问到$route的时候 其实是在访问_routerRoot._route
  Object.defineProperty(Vue.prototype, '$route', {
    get () { return this._routerRoot._route }
  })

  // 全局注册router-view  router-link 组件
  Vue.component('router-view', View)
  Vue.component('router-link', Link)

  // 配置的合并策略
  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  // 路由生命周期的合并策略 和created的一样
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
