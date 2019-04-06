import {init} from '../../engine/sys'
import * as AppSys from './sys'


export default (hooks) => {
  AppSys.registerHooks(hooks)
  return init(AppSys)
}