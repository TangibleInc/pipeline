import { $ } from 'bun'
import path from 'node:path'
import fs from 'node:fs/promises'
import { getEventMeta, isTestEnvironment, getProjectConfig } from './common'

/**
 * Prepare release
 *
 * - Rename zip file based on version tag or branch name
 * - Create release notes from commit messages
 */
export async function beforeRelease() {
  console.log('Prepare release')

  const { repoFullName, eventType, gitRef, gitRefName } = await getEventMeta()

  console.log('Repository', repoFullName)
  console.log('Event type', eventType)
  console.log('Git ref', gitRef)

  const projectPath = process.cwd()
  const publishPath = path.join(projectPath, 'publish')
  const releaseTextPath = path.join(publishPath, `release.md`)

  const config = await getProjectConfig({ projectPath })

  if (!config || !config.archive) {
    console.log('No config found for creating a zip archive')
    console.log('Skipping..')
    return
  }

  // Source zip file

  const zipFileName = config.archive.root
    ? `${config.archive.root}.zip`
    : config.archive.dest
  const sourceZipPath = path.join(publishPath, zipFileName)

  if (!(await fs.exists(sourceZipPath))) {
    console.log('Source zip file not found', sourceZipPath)
    return
  }

  console.log('Source zip file', sourceZipPath)

  async function writeRelease(text: string) {
    console.log('Write release text', releaseTextPath)
    console.log(text)
    await fs.writeFile(releaseTextPath, text)
  }

  // Ensure file exists for next step
  await fs.writeFile(releaseTextPath, '')

  /**
   * List commit messages since last version tag
   */

  $.cwd(projectPath)

  console.log('Gather commit messages since last version tag')
  let commitLogs
  try {
    let previousTag = (
      await $`git describe --tags --always --match "*.*.*" --abbrev=0 ${
        eventType === 'tag' ? '@^' : ''
      }`.text()
    ).trim()

    if (!previousTag) {
      console.log('No previous version tag found')
    } else {
      console.log('Since previous tag', previousTag)
      const result = await $`git log ${
        // Pass as single argument
        `${previousTag}..HEAD`
      } --oneline --no-merges --pretty="%h %s"`.nothrow() //.text()
      if (result.exitCode !== 0) {
        console.log(result.stderr.toString())
      } else {
        commitLogs = result.stdout.toString()
      }
    }
  } catch (e) {
    console.log(e.message)
  }

  // Format commits into Markdown list with link
  if (commitLogs) {
    commitLogs = commitLogs
      .split('\n')
      .filter(Boolean)
      .map((s) => {
        const [commit, ...parts] = s.split(' ')
        return `- [${commit}](https://github.com/${repoFullName}/commit/${commit}) ${parts.join(' ')}`
      })
      .join('\n')
  }

  // Tag

  if (eventType === 'tag') {
    const tag = gitRefName
    console.log('Release on tag', tag)

    await writeRelease(
      `# Release tag ${tag}${commitLogs ? `\n\n${commitLogs}` : ''}`,
    )

    // `{plugin}-{version}.zip`

    const targetZipPath = sourceZipPath.replace('.zip', `-${tag}.zip`)

    console.log('Target zip file', targetZipPath)
    await fs.rename(sourceZipPath, targetZipPath)

    return
  }

  const branch = gitRefName

  // Main/master branch

  if (branch === 'main' || branch === 'master') {
    console.log('Release preview on main/master branch')

    await writeRelease(
      `# Release preview${commitLogs ? `\n\n${commitLogs}` : ''}`,
    )

    // `{plugin}-latest.zip`

    const targetZipPath = sourceZipPath.replace('.zip', `-latest.zip`)

    console.log('Target zip file', targetZipPath)
    await fs.rename(sourceZipPath, targetZipPath)

    return
  }

  // Feature branch

  console.log('Release preview on branch', branch)

  // `{plugin}-{branch}-latest.zip`

  await writeRelease(
    `# Branch preview ${branch}${commitLogs ? `\n\n${commitLogs}` : ''}`,
  )

  const targetZipPath = sourceZipPath.replace(
    '.zip',
    `-${slugify(branch.replace(/\//g, '-'))}-latest.zip`,
  )

  console.log('Target zip file', targetZipPath)
  await fs.rename(sourceZipPath, targetZipPath)
}

function slugify(str: string) {
  return String(str)
    .normalize('NFKD') // split accented characters into their base characters and diacritical marks
    .replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
    .trim() // trim leading or trailing whitespace
    .toLowerCase() // convert to lowercase
    .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-') // remove consecutive hyphens
}

// Run automatically when used in pipeline script
if (!isTestEnvironment) {
  await beforeRelease()
}
