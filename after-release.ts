import path from 'node:path'
import fs from 'node:fs/promises'
import { getEventMeta } from './common'
/**
 * After release
 *
 * - Deploy metadata
 */
async function main() {
  console.log('After release')

  const projectPath = process.cwd()
  const deployMetaPath = path.join(projectPath, 'deploy-meta.json')

  const {
    repoFullName,
    eventType = 'unknown',
    gitRef,
    gitRefName,
  } = await getEventMeta()

  const data = {
    type: 'git',
    source: `https://github.com/${repoFullName}`,
    time: new Date().toISOString().slice(0, 19).replace('T', ' '),
  }

  // branch or tag
  data[eventType] = gitRefName

  console.log(data)
  console.log()

  await fs.writeFile(deployMetaPath, JSON.stringify(data, null, 2), 'utf8')

  console.log('Wrote', deployMetaPath)

  const deployEventUrl = `https://log.tangible.one`
  const response = await fetch(deployEventUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  console.log('Response', response.status, response.statusText)

  const body = await response.text()

  console.log(body)
}

main()
