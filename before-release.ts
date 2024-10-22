import { $ } from 'bun'
import path from 'node:path'
import fs from 'node:fs/promises'
import { getEventMeta } from './common'

/**
 * Prepare release
 *
 * - Rename zip file based on version tag or branch name
 * - TODO: Create release notes from commit messages
 */
async function main() {
  console.log('Prepare release')

  const projectPath = process.cwd()
  const publishPath = path.join(projectPath, 'publish')
  const configPath = path.join(projectPath, 'tangible.config.js')

  /**
   * [GitHub default environment variables](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables)
   */

  const { repoFullName, eventType, gitRef, gitRefName } = await getEventMeta()

  console.log('Repository', repoFullName)
  console.log('Event type', eventType)
  console.log('Git ref', gitRef)

  if (!(await fs.exists(configPath))) {
    console.log('Config file not found', configPath)
    console.log('Skip zip archive release')
    return
  }

  // Source zip file

  const config = (await import(configPath)).default

  const zipFileName = `${config.archive.root}.zip`
  const sourceZipPath = path.join(publishPath, zipFileName)

  if (!(await fs.exists(sourceZipPath))) {
    console.log('Source zip file not found', sourceZipPath)
    return
  }

  console.log('Source zip file', sourceZipPath)

  const releaseTextPath = path.join(publishPath, `release.md`)

  async function writeRelease(text: string) {
    console.log('Write release text', releaseTextPath)
    console.log(text)
    await fs.writeFile(releaseTextPath, text)
  }

  /**
   * List commit messages since last version tag
   */

  console.log('Gather commit messages since last version tag')
  let commitLogs
  try {
    const previousTag =
      await $`git describe --tags --match "*.*.*" --abbrev=0`.text()

    if (!previousTag) {
      console.log('No previous version tag found')
    } else {
      commitLogs =
        await $`git log ${previousTag}..HEAD --oneline --no-merges`.text()
    }
  } catch (e) {
    console.log(e.message)
  }

  // Tag

  if (eventType === 'tag') {
    const tag = gitRefName
    console.log('Release on tag', tag)

    if (commitLogs) {
      await writeRelease(commitLogs)
    }

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
    `-${slugify(branch)}-latest.zip`,
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

main()
