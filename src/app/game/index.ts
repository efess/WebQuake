import {init} from '../../engine/sys'
import * as AppSys from './sys'


export default (args, hooks) => {
  AppSys.registerHooks(hooks)
  init(args, AppSys)
  return AppSys
}