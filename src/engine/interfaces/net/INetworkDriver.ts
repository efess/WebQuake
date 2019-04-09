import ISocket from './ISocket'
import IDatagram from './IDatagram'

export default interface INetworkDriver {
  initialized: boolean,
  available: boolean,
  name: string,
  init: () => boolean,
  connect: (host: string) => any,
  checkNewConnections: () => ISocket,
  checkForResend: () => number,
  close: (sock: ISocket) => void,
  canSendMessage: (sock: ISocket) => boolean,
  sendMessage: (sock: ISocket, data: IDatagram) => number,
  sendUnreliableMessage: (sock: ISocket, data: IDatagram) => number,
  getMessage: (sock: ISocket) => any,
  listen: () => void,
  registerWithMaster: () => void
} 