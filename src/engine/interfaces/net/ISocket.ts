export default interface ISocket {
  connecttime: number,
  lastMessageTime: number,
  driver: number,
  address: string,
  disconnected: boolean,
  canSend: boolean,
  receiveMessage: any,
  receiveMessageLength: number,
  driverdata: any,
  // Original udp driver fields
  sendMessage: any,
  sendMessageLength: number,
  lastSendTime: number,
  ackSequence: number,
  sendSequence: number,
  unreliableSendSequence: number,
  receiveSequence: number,
  unreliableReceiveSequence: number,
  addr: string,
  messages: Buffer[]
}