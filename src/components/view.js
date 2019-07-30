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
    data.routerView = true

    // directly use parent context's createElement() function
    // so that components rendered by router-view can resolve named slots
    // parent父组件的vue实例
    const h = parent.$createElement
    // 命名视图
    const name = props.name
    //
    const route = parent.$route
    // keep alive
    const cache = parent._routerViewCache || (parent._routerViewCache = {})

    // determine current view depth, also check to see if the tree
    // has been toggled inactive but kept-alive.
    let depth = 0
    let inactive = false
    // 一直往上找直到根，计算有多少个层级 嵌套的route view
    while (parent && parent._routerRoot !== parent) {
      if (parent.$vnode && parent.$vnode.data.routerView) {
        depth++
      }
      if (parent._inactive) {
        inactive = true
      }
      parent = parent.$parent
    }
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
      cache[name] = null
      return h()
    }

    // 找到匹配的组件
    const component = cache[name] = matched.components[name]

    // attach instance registration hook
    // this will be called in the instance's injected lifecycle hooks
    //  Vue.mixin beforeCreate destroyed 中有执行registerInstance
    data.registerRouteInstance = (vm, val) => {
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
