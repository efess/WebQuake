import IPackedFile from './IPackedFile'

export default interface IAssetStore {
  loadStorePackFiles: (game: string) => Promise<Array<{name: string, data: ArrayBuffer, contents: IPackedFile[]}>>,
  loadPackFile: (dir: string, packName: string) => Promise<IPackedFile[]>,
  loadFile: (filename: string) => Promise<ArrayBuffer>,
  writeFile: (filename: string, data: Uint8Array, len: number) => Promise<boolean>,
  writeTextFile: (filename: string, data: string) => Promise<boolean>,
} 