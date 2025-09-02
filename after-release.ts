import { Glob } from 'bun'
import path from 'node:path'
import fs from 'node:fs/promises'
import { getEventMeta, isTestEnvironment, getProjectConfig } from './common'
/**
 * After release
 *
 * - Deploy metadata
 */
export async function afterRelease() {
  console.log('After release - Test Branch')

  const projectPath = process.cwd()
  const deployMetaPath = path.join(projectPath, 'deploy-meta.json')
  const config = (await getProjectConfig({ projectPath })) || {}

  const {
    repoFullName = '',
    eventType = 'unknown',
    gitRef,
    gitRefName,
  } = await getEventMeta()

  const isCommit = eventType === 'branch'
  const isTag = eventType === 'tag'

  const [orgName, repoName] = repoFullName.split('/')
  const repoUrl = `https://github.com/${repoFullName}`

  const data = {
    type: 'git',
    event: isCommit ? 'commit' : eventType,
    source: repoUrl,
    time: new Date().toISOString().slice(0, 19).replace('T', ' '),
  }

  // branch or tag
  data[eventType] = gitRefName

  // Find zip archive file name
  const zipPattern = isTag ? `*-${gitRefName}.zip` : `*latest.zip`
  const glob = new Glob(zipPattern)

  const publishPath = './publish'
  const file =
    (await fs.exists(publishPath)) &&
    (await Array.fromAsync(glob.scan({ cwd: publishPath }))).pop()
  if (file) {
    data.file = file
    data.fileDownload = `${repoUrl}/releases/download/${
      isTag ? gitRefName : 'latest'
    }/${file}`
  }

  if (config.archive) {
    data.archiveName = config.archive.root || repoName
    data.archiveFile = config.archive.dest
      ? config.archive.dest.split('/').pop()
      : `${repoName}.zip`
  }

  // Upload zip on tangible cloud website

  if (!isTestEnvironment) {
    console.log(data)
    console.log()
  }

  await fs.writeFile(deployMetaPath, JSON.stringify(data, null, 2), 'utf8')

  console.log('Wrote', deployMetaPath)

  const deployEventUrl = isTestEnvironment
    ? `http://localhost:3333`
    : `https://api.tangible.one`

  try {
    const response = await fetch(deployEventUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    console.log('Response', response.status, response.statusText)

    const body = await response.text()
    console.log(body)
  } catch (e) {
    console.error(e)
  }
}

// Run automatically when used in pipeline script
if (!isTestEnvironment) {
  await afterRelease()
}
