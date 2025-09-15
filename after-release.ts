import { Glob } from 'bun'
import path from 'node:path'
import fs from 'node:fs/promises'
import { getEventMeta, isTestEnvironment, getProjectConfig } from './common'
import { execSync } from 'node:child_process'

/**
 * After release
 *
 * - Deploy metadata
 */
export async function afterRelease() {
  console.log('After release')

  const projectPath = process.cwd()
  const deployMetaPath = path.join(projectPath, 'deploy-meta.json')
  const packageJsonPath = path.join(projectPath, 'package.json')
  const readmePath = path.join(projectPath, 'readme.txt')
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

  // Get package.json contents
  let pluginId: number
  let productId: number

  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageJsonContent)

    // Set ids
    pluginId = packageJson?.cloud?.pluginId
    productId = packageJson?.cloud?.productId
    
  } catch (error) {
    console.log('Could not read package.json:', error.message)
  }

  // Try reading changelog from readme.txt
  let changelog = 'No changelog provided'

  try {
    changelog = await fs.readFile(readmePath, 'utf8')
  } catch (error) {
    console.log('Could not read changelog (readme.txt):', error.message)
  }
  
  const data = {
    type: 'git',
    pluginId,
    productId,
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
  if (pluginId && productId) {
    try {
      const localZipPath = path.join(publishPath, file);
      // Check if the local file exists
      await fs.access(localZipPath);
      
      // Build the curl command - use local file path, not URL
      const curlCommand = [
        'curl -X POST "https://cloud.tangible.one/api/bitbucket/downloads"',
        `--form files=@"${localZipPath}"`,
        `--form "product_id=${productId}"`,
        `--form "plugin_id=${pluginId}"`,
        `--form "version=${isTag ? gitRefName : 'unknown'}"`,
        `--form "changelog=${changelog.replace(/"/g, '\\"')}"`,
        `--form "slug=${repoName}"`
      ].join(' \\\n     ');

      console.log('Executing curl command:');
      console.log(curlCommand);

      // Execute the curl command
      const result = execSync(curlCommand, { encoding: 'utf-8' });
      console.log('Upload successful:', result);

    } catch (error) {
      console.log('File not uploaded on cloud: ' + error.message);
    }
  }

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
