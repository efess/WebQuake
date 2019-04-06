import IPackedFile from "./IPackedFile";

export default interface ISearch {
  dir: string
  type: string
  packs: IPackedFile[][]
} 