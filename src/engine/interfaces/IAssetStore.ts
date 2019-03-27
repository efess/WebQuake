export default interface IAssetStore {
  loadPackFile: (filename: string) => Promise<any>,
  loadFile: (filename: string) => Promise<any>,
  writeFile: (filename: string, data: Uint8Array, len: number) => Promise<boolean>,
  writeTextFile: (filename: string, data: string) => Promise<boolean>,
} 