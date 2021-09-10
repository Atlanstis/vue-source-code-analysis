# Virtual-DOM

## 创建过程

在 vue 组件创建的过程中，我们可以通过手写 render 函数来进行。

创建方式如下所示：

```js
// example/1-virtualdom.html
const vm = new Vue({
  el: '#app',
  render (h) {
    // h(tag, data, children)
    // return h('h1', this.msg)
    // return h('h1', { domProps: { innerHTML: this.msg } })
    // return h('h1', { attrs: { id: 'title' } }, this.msg)
    const vnode = h(
      'h1', 
      { 
        attrs: { id: 'title' } 
      },
      this.msg
    )
    console.log(vnode)
    return null
  },
  data: {
    msg: 'Hello Vue'
  }
})
```

此时，我们可以通过 render 函数提供 h 函数，创建一个 vnode，并通过返回 vnode 的方法进行组件的创建。

### h 函数

- 对应于 vue 提供的 vm.$createElement(tag, data, children, normalizeChildren)
  - tag
    - 标签名称或者组件名称
  - data
    - 描述 tag，可以设置 DOM 的属性或者标签的属性
  - children
    - tag 中的文本内容或者子节点

> 详细使用：[渲染函数 & JSX — Vue.js](https://cn.vuejs.org/v2/guide/render-function.html)

### vnode

而通过 h 函数创建的 vnode，如下图所示。

<img src="assets/1.vnode.png" alt="1.vnode" style="zoom:50%;" />

其中，以下为核心属性：

- tag：标签名
- data：data 选项
- children：子节点，当最后一个参数设置为字符串时，会 自动转换成一个 vnode 对象，用来描述文本节点
- text：文本节点
- elm：记录真实 DOM
- key：用于复用元素，diff 中会使用

## 整体过程分析

## VNode 的创建过程

其核心是 createElement()，也就是 h 函数。

- 路径：src/core/vdom/create-element.js

在创建渲染 Watcher 的过程中，定义了一个 updateComponent()，updateComponent() 方法会在 watcher 实例初始化时被执行。其作用时，生成一个 虚拟 DOM，并将其映射到真实 DOM 上。

```js
// src/core/instance/lifecycle.js

updateComponent = () => {
  vm._update(vm._render(), hydrating)
}

new Watcher(vm, updateComponent, noop, {
  before () {
    if (vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'beforeUpdate')
    }
  }
}, true /* isRenderWatcher */)
```

vm._render() 的定义位于 src/core/instance/render.js 下。

```js
const { render, _parentVnode } = vm.$options
// ...
vnode = render.call(vm._renderProxy, vm.$createElement)
```

通过 call 方法，将 vm.$createElement 方法传入，及手写 render 中的 h 函数。

vm.$createElement 的定义位于src/core/instance/render.js 下。

```js
// 对编译生成的 render 进行渲染的方法
vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
// 对手写 render 函数进行渲染的方法
vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)
```

最终调用 createElement() 方法进行 vnode 的创建。

```js
export function createElement (
  // vue 实例
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any,
  // true：手写的 render 函数
  alwaysNormalize: boolean
): VNode | Array<VNode> {
  // 处理传入参数不同的情况
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children
    children = data
    data = undefined
  }
	// normalizationType 用于处理 children 参数
  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE
  }
  return _createElement(context, tag, data, children, normalizationType)
}
```

在 createElement() 中，首先对传入参数个数不同的情况进行的兼容处理。

最后调用 _createElement 方法。

```js
export function _createElement (
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> {
  if (isDef(data) && isDef((data: any).__ob__)) {
  	// ...
    return createEmptyVNode()
  }
  // object syntax in v-bind
  // 针对动态组件 <compontent :is="current"></compontent>
  if (isDef(data) && isDef(data.is)) {
    tag = data.is
  }
  if (!tag) {
    // in case of component :is set to falsy value
    return createEmptyVNode()
  }
  // warn against non-primitive key
  if (process.env.NODE_ENV !== 'production' &&
    isDef(data) && isDef(data.key) && !isPrimitive(data.key)
  ) {
    if (!__WEEX__ || !('@binding' in data.key)) {
      warn(
        'Avoid using non-primitive value as key, ' +
        'use string/number value instead.',
        context
      )
    }
  }
  // support single function children as default scoped slot
  // 针对作用域插槽
  if (Array.isArray(children) &&
    typeof children[0] === 'function'
  ) {
    data = data || {}
    data.scopedSlots = { default: children[0] }
    children.length = 0
  }
  if (normalizationType === ALWAYS_NORMALIZE) {
    // 返回一维数组，处理用户手写的 render
    children = normalizeChildren(children)
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    // 把二维数组，转换成一维数组
    children = simpleNormalizeChildren(children)
  }
  // 创建 vnode
  let vnode, ns
  if (typeof tag === 'string') {
    let Ctor
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
    if (config.isReservedTag(tag)) {
      // 是否是 html 的保留标签
      // platform built-in elements
      if (process.env.NODE_ENV !== 'production' && isDef(data) && isDef(data.nativeOn) && data.tag !== 'component') {
        warn(
          `The .native modifier for v-on is only valid on components but it was used on <${tag}>.`,
          context
        )
      }
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
    } else if ((!data || !data.pre) && isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // 判断是否是 自定义组件
      // 查找自定义组件构造函数的声明
      // 根据 Ctor 创建组件的 vnode
      // component
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      // 自定义标签
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children)
  }
  if (Array.isArray(vnode)) {
    return vnode
  } else if (isDef(vnode)) {
    if (isDef(ns)) applyNS(vnode, ns)
    if (isDef(data)) registerDeepBindings(data)
    return vnode
  } else {
    return createEmptyVNode()
  }
}
```

在 _createElement() 方法中，针对 key，动态组件，作用域插槽，children 进行了处理。

之后根据 tag 的情况：

- html 的保留标签
- 自定义组件
- 自定义标签

进行响应的处理，最终返回了一个 vnode。

## update

在之前的 vm.\_render() 方法中，成功获取到了 一个 vnode 对象，之后会调用 vm.\_update 方法将 VNode 渲染为真实的 DOM。

- \_update  路径：src/core/instance/lifecycle.js

```js
  // _update 方法的作用是把 VNode 渲染成真实的 DOM
  // 首次渲染会调用，数据更新会调用
	Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const restoreActiveInstance = setActiveInstance(vm)
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    if (!prevVnode) {
      // initial render
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
    } else {
      // updates
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    restoreActiveInstance()
    // update __vue__ reference
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }
```

\_update 的作用是判断 prevVnode 是否存在（即当前节点是否时首次渲染）

- 不存在时，将 vm.$el 转换成 vNode，并将新的 vNode 进行比较，并将差异渲染到真实 DOM 上
- 存在时，比较新旧 vNode，并将差异更新到真实 DOM 上

