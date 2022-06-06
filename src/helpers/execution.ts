import fs from 'fs'
import process from 'process'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

export const fromDirectory = async (hre: HardhatRuntimeEnvironment, directory: string, fn: () => Promise<boolean> ): Promise<boolean> => {
  if (fs.existsSync(directory)) {
    process.chdir(directory)
  }
  const result = await fn()

  process.chdir(hre.config.paths.root)

  return result
}