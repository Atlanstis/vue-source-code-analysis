/* @flow */

// nodeOps：dom 相关操作函数
import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
// 处理 ref，directives
import baseModules from 'core/vdom/modules/index'
// 处理 attrs，class 等
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)

export const patch: Function = createPatchFunction({ nodeOps, modules })
