import { init } from "../sys";
import IAssetStore from "./store/IAssetStore";

export interface ISys {
  print: (text: string) => void,
  quit: () => void,
  floatTime: () => number,
  error: (text: string) => void,
  getExternalCommand: () => string,
  init: () => void,
  assetStore: IAssetStore
}