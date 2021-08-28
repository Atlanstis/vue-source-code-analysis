# 响应式原理

## 初始化过程

vue 源码中，入口位于 `src/platforms/web` 下。

- entry-runtime-with-compiler.js：对应 编辑器 + 运行时 版本
- entry-runtime.js：对应 运行时 版本

`entry-runtime-with-compiler.js` 下，

- el 不能是 body 或者 html 标签
- 如果没有 render 函数，把 template / el 转换成 render 函数
- 如果有 render 函数，直接调用 mount 挂载 DOM

```js
// src/platforms/web/entry-runtime-with-compiler.js

// 保留 Vue 实例的 $mount 方法
const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (
  el?: string | Element,
  // 非 ssr 情况下为 false，ssr 时候为 true
  hydrating?: boolean
): Component {
  // 获取 el 对象
  el = el && query(el)

  /* istanbul ignore if */
  // el 不能为 body 或者 html
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  // 把 template/el 转换成 render 函数
  if (!options.render) {
    let template = options.template
    // 如果模板存在
    if (template) {
      if (typeof template === 'string') {
        // 如果模板是 id 选择器
        if (template.charAt(0) === '#') {
          // 获取对应的 DOM 对象的 innerHTML
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        // 如果模板是元素，返回元素的 innerHTML
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      template = getOuterHTML(el)
    }
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  // 调用 mount 方法，渲染 DOM
  return mount.call(this, el, hydrating)
}
```

### 平台相关属性，函数

在 `src/platforms/web/runtime/index.js` 下，处理了与平台相关的函数。

- 注册了与平台相关的指令 v-mode、v-show，组件 transition、transition-group。
- 注册了 `__patch__` 与 $mount 方法。

```js
// src/platforms/web/runtime/index.js

// install platform specific utils
// 判断是否是关键属性（表单元素的 input/checked/selected/muted）
// 如果是这些属性，设置 el.props 属性（属性不设置到标签上）
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag
Vue.config.isReservedAttr = isReservedAttr
Vue.config.getTagNamespace = getTagNamespace
Vue.config.isUnknownElement = isUnknownElement

// install platform runtime directives & components
// 注册 指令 v-model、v-show
extend(Vue.options.directives, platformDirectives)
// 注册 组件 transition、transition-group
extend(Vue.options.components, platformComponents)

// install platform patch function
Vue.prototype.__patch__ = inBrowser ? patch : noop

// public mount method
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined
  return mountComponent(this, el, hydrating)
}
```

### 构造函数增加静态方法

在 `src/core/index.js` 下，通过 initGlobalAPI 方法，给 Vue 的构造函数增加了静态方法。

```js
// src/core/index.js

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  // 初始化 Vue.config 对象
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // 这些工具方法不视作全局 API 的一部分，除非你已经意识到某些风险，否则不要去依赖它们
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // 静态方法 set/del/nextTick
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  // 让一个对象可响应
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }
  
  // 初始化 Vue.options 对象，并给其拓展
  // components/directives/filters
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue

  // 设置 keep-alive 组件
  extend(Vue.options.components, builtInComponents)

  // 注册 Vue.use() 用来注册插件
  initUse(Vue) 实现混入
  // 注册 Vue.mixin()
  initMixin(Vue)
  // 注册 Vue.extend() 基于传入的 options 返回一个组件的构造函数
  initExtend(Vue)
  // 注册 Vue.directive()、Vue.component()、Vue.filter()
  initAssetRegisters(Vue)
}
```

### 构造函数

Vue 的构造函数位于 `src/core/instance/index.js` 下。

```js
// src/core/instance/index.js

// 此处不用 class 的原因是因为方便后续给 Vue 实例混入实例变量
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 调用 _init 方法
  this._init(options)
}

// 注册 vm 的 _init 方法，初始化 vm
initMixin(Vue)
// 注册 vm 的 $data/$props/$set/$delete/$watch
stateMixin(Vue)
// 初始化事件相关方法
// $on/$off/$once/$emit
eventsMixin(Vue)
// 初始化生命周期相关的混入方法
// _update/$forceUpdate/$destroy
lifecycleMixin(Vue)
// 混入 render
// $nextTick/_render
renderMixin(Vue)
```

### 总结

- src/platforms/web/entry-runtime-with-compiler.js
  - web 平台相关的入口
  - 重写了平台相关的 $mount() 方法
  - 注册了 Vue.compile() 方法，传递一个 HTML 字符串返回 render 函数
- src/platforms/web/runtime/index.js
  - web 平台相关
  - 注册和平台相关的全局指令：v-model、v-show
  - 注册和平台相关的全局组件： v-transition、v-transition-group
  - 全局方法：
    - _patch__：把虚拟 DOM 转换成真实 DOM
    - $mount：挂载方法
- src/core/index.js
  - 与平台无关
  - 设置了 Vue 的静态方法，initGlobalAPI(Vue)
- src/core/instance/index.js
  - 与平台无关
  - 定义了构造函数，调用了 this._init(options) 方法
  - 给 Vue 中混入了常用的实例成员

