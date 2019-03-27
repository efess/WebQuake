import {ISys} from './interfaces/ISys'

var sysImpl: ISys = null

export function init(sys: ISys) {
	sysImpl = sys
	sysImpl.init()
}

export const error = (text: string): void =>
{
	return sysImpl.error(text)
}
export const print = (text: string): void =>
{
	return sysImpl.print(text)
}
export const quit = () =>
{
	return sysImpl.quit()
}
export const floatTime = (): number =>
{
	return sysImpl.floatTime()
}

export const getExternalCommand = (): string => {
	return sysImpl.getExternalCommand()
}