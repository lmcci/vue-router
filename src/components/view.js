import { warn } from '../util/warn'

export default {
  name: 'router-view',
  functional: true,
  props: {
    name: {
      type: String,
      default: 'default'
    }
  },
  // 函数式组件
  render (_, { props, children, parent, data }) {
    // 只是一个标记 下面的嵌套判断会用来计算深度
    data.routerView = true

    // directly use parent context's createElement() function
    // so that components rendered by router-view can resolve named slots
    // parent父组件的vue实例
    const h = parent.$createElement
    // 通过props传入的name  命名视图  <router-view name="a"></router-view>
    const name = props.name
    // 当前的route实例
    const route = parent.$route
    // keep alive 相关
    const cache = parent._routerViewCache || (parent._routerViewCache = {})

    // determine current view depth, also check to see if the tree
    // has been toggled inactive but kept-alive.
    let depth = 0
    let inactive = false
    // 一直往上找直到根，计算有多少个层级 嵌套的route view
    // parent._routerRoot === parent
    // _routerRoot就是根vm 当想等的时候就是到根了
    while (parent && parent._routerRoot !== parent) {
      //  父组件中有routerView true   已经嵌套一层了
      if (parent.$vnode && parent.$vnode.data.routerView) {
        depth++
      }
      if (parent._inactive) {
        inactive = true
      }
      parent = parent.$parent
    }
    // 获得总的嵌套深度
    data.routerViewDepth = depth

    // render previous view if the tree is inactive and kept-alive
    if (inactive) {
      return h(cache[name], data, children)
    }

    // matched是根据向上查找parent加入的  这里按着深度取出对应的record
    const matched = route.matched[depth]
    // render empty node if no matched route
    // 没有匹配的记录 就返回一个空的
    if (!matched) {
      // 缓存也置空
      cache[name] = null
      // 渲染空节点
      return h()
    }

    // 找到匹配的组件 缓存一下
    const component = cache[name] = matched.components[name]

    // attach instance registration hook
    // this will be called in the instance's injected lifecycle hooks
    //  Vue.mixin beforeCreate destroyed 中有执行registerInstance
    // record中有instances对象
    data.registerRouteInstance = (vm, val) => {
      // 把传入的instance放在对应的record上
      // val could be undefined for unregistration
      const current = matched.instances[name]
      if (
        (val && current !== vm) ||
        (!val && current === vm)
      ) {
        matched.instances[name] = val
      }
    }

    // also register instance in prepatch hook
    // in case the same component instance is reused across different routes
    ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
      matched.instances[name] = vnode.componentInstance
    }

    // resolve props
    // 处理router-view的props
    let propsToPass = data.props = resolveProps(route, matched.props && matched.props[name])
    if (propsToPass) {
      // clone to prevent mutation
      propsToPass = data.props = extend({}, propsToPass)
      // pass non-declared props as attrs
      const attrs = data.attrs = data.attrs || {}
      for (const key in propsToPass) {
        if (!component.props || !(key in component.props)) {
          attrs[key] = propsToPass[key]
          delete propsToPass[key]
        }
      }
    }

    // 渲染组件
    // $createElement
    return h(component, data, children)
  }
}

function resolveProps (route, config) {
  switch (typeof config) {
    case 'undefined':
      return
    case 'object':
      return config
    case 'function':
      return config(route)
    case 'boolean':
      return config ? route.params : undefined
    default:
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false,
          `props in "${route.path}" is a ${typeof config}, ` +
          `expecting an object, function or boolean.`
        )
      }
  }
}

// 把from的所有属性都放在to上
function extend (to, from) {
  for (const key in from) {
    to[key] = from[key]
  }
  return to
}
