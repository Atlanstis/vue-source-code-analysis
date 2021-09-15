# 组件化

## 组件注册

### 全局组件注册方式

```js
Vue.component('comp', { template: '<h1>hello</h1>' })
```

### 相关代码

```js
// src\core\global-api\index.js
// 注册 Vue.directive()、 Vue.component()、Vue.filter() 
initAssetRegisters(Vue) 

// src\core\global-api\assets.js 
if (type === 'component' && isPlainObject(definition)) { 
  definition.name = definition.name || id 
  definition = this.options._base.extend(definition) 
}
……
// 全局注册，存储资源并赋值 
// this.options['components']['comp'] = Ctor 
this.options[type + 's'][id] = definition 

// src\core\global-api\index.js 
// this is used to identify the "base" constructor to extend all plain-object 
// components with in Weex's multi-instance scenarios. 
Vue.options._base = Vue 

// src\core\global-api\extend.js 
Vue.extend()
```

从 initAssetRegisters 入口开始，通过 Vue.extend() 把组件配置转换为组件的构造函数，并存储到 Vue.options.components 下。

## Vue.extend

把组件的选项对象，转化成 Vue 构造函数的子类。

- 路径：src/core/global-api/extend.js

```js
export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    // Vue 构造函数
    const Super = this
    const SuperId = Super.cid
    // 从缓存中加载组件的构造函数
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      // 如果是开发环境，验证组件的名称
      validateComponentName(name)
    }

    const Sub = function VueComponent (options) {
      // 调用 _init() 初始化
      this._init(options)
    }
    // 原型继承自 Vue
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    Sub.cid = cid++
    // 合并 options
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    cachedCtors[SuperId] = Sub
    return Sub
  }
}
```

## **组件** **VNode** 的创建过程

- 创建根组件，首次 _render() 时，会得到整棵树的 VNode 结构

- 整体流程：new Vue() --> $mount() --> vm._render() --> createElement() --> createComponent()

- 创建组件的 VNode，初始化组件的 hook 钩子函数

```js
// 1. _createElement() 中调用 createComponent() 
// src\core\vdom\create-element.js
else if ((!data || !data.pre) && isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
  // 判断是否是 自定义组件
  // 查找自定义组件构造函数的声明
  // 根据 Ctor 创建组件的 vnode
  // component
  vnode = createComponent(Ctor, data, context, children, tag)
} 
  
// 2. createComponent() 中调用创建自定义组件对应的 VNode 
// src\core\vdom\create-component.js 
export function  createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  if (isUndef(Ctor)) {
    return
  }
	// ...
	// install component management hooks onto the placeholder node 
	// 安装组件的钩子函数 init/prepatch/insert/destroy 
	// 初始化了组件的 data.hooks 中的钩子函数 
	installComponentHooks(data)	
	// return a placeholder vnode 
	const name = Ctor.options.name || tag 
  // 创建自定义组件的 VNode，设置自定义组件的名字 
  // 记录this.componentOptions = componentOptions
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )
  return vnode
}

// 3. installComponentHooks() 初始化组件的 data.hook
function installComponentHooks (data: VNodeData) { 
  const hooks = data.hook || (data.hook = {}) 
  // 用户可以传递自定义钩子函数 
  // 把用户传入的自定义钩子函数和 componentVNodeHooks 中预定义的钩子函数合并 
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    const existing = hooks[key]
    const toMerge = componentVNodeHooks[key]
    if (existing !== toMerge && !(existing && existing._merged)) {
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}

// 4. 钩子函数定义的位置（init()钩子中创建组件的实例）
// inline hooks to be invoked on component VNodes during patch
const componentVNodeHooks = {
  init (vnode: VNodeWithData, hydrating: boolean): ?boolean {
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      // kept-alive components, treat as a patch
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      // 创建组件实例挂载到 vnode.componentInstanc
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance
      )
      // 调用组件对象的 $mount()，把组件挂载到页面
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },

  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
  	// ...
  },

  insert (vnode: MountedComponentVNode) {
    // ...
  },

  destroy (vnode: MountedComponentVNode) {
    // ...
  }
}

//5 .创建组件实例的位置，由自定义组件的 init() 钩子方法调用
export function createComponentInstanceForVnode (
  // we know it's MountedComponentVNode but flow doesn't
  vnode: any,
  // activeInstance in lifecycle state
  parent: any
): Component {
  const options: InternalComponentOptions = {
    _isComponent: true,
    _parentVnode: vnode,
    parent
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  // 获取 inline-template
  // <comp inline-template> xxxx </comp>
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  // 创建组件实例
  return new vnode.componentOptions.Ctor(options)
}
```

## 组件实例的创建和挂载过程

- Vue._update() --> patch() --> createElm() --> createComponent()

```js
// src\core\vdom\patch.js 
// 1. 创建组件实例，挂载到真实 DOM
function createComponent (vnode, insertedVnodeQueue, parentElm, refElm) {
  let i = vnode.data
  if (isDef(i)) {
    const isReactivated = isDef(vnode.componentInstance) && i.keepAlive
    if (isDef(i = i.hook) && isDef(i = i.init)) {
      // 调用 init 方法，创建和挂载组件实例
      // init() 的过程中创建好了组件的真实 DOM，挂载到了 vnode.elm 上
      i(vnode, false /* hydrating */)
    }
    // after calling the init hook, if the vnode is a child component
    // it should've created a child instance and mounted it. the child
    // component also has set the placeholder vnode's elm.
    // in that case we can just return the element and be done.
    if (isDef(vnode.componentInstance)) {
      // 调用钩子函数（vnode 的钩子函数初始化属性/事件/样式等，组件的钩子函数）
      initComponent(vnode, insertedVnodeQueue)
      // 把组件对应的 DOM 插入到父元素中
      insert(parentElm, vnode.elm, refElm)
      if (isTrue(isReactivated)) {
        reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
      }
      return true
    }
  }
}

// 2. 调用钩子函数，设置局部作用于样式
function initComponent (vnode, insertedVnodeQueue) {
  if (isDef(vnode.data.pendingInsert)) {
    insertedVnodeQueue.push.apply(insertedVnodeQueue, vnode.data.pendingInsert)
    vnode.data.pendingInsert = null
  }
  vnode.elm = vnode.componentInstance.$el
  if (isPatchable(vnode)) {
    // 调用钩子函数
    invokeCreateHooks(vnode, insertedVnodeQueue)
    // 设置局部作用于样式
    setScope(vnode)
  } else {
    // empty component root.
    // skip all element-related modules except for ref (#3455)
    registerRef(vnode)
    // make sure to invoke the insert hook
    insertedVnodeQueue.push(vnode)
  }
}

// 3. 调用钩子函数
function invokeCreateHooks (vnode, insertedVnodeQueue) {
  // 调用 VNode 的钩子函数
  for (let i = 0; i < cbs.create.length; ++i) {
    cbs.create[i](emptyNode, vnode)
  }
  i = vnode.data.hook // Reuse variable
  // 调用组件的钩子函数
  if (isDef(i)) {
    if (isDef(i.create)) i.create(emptyNode, vnode)
    if (isDef(i.insert)) insertedVnodeQueue.push(vnode)
  }
}
```

