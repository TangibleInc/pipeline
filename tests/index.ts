import path from 'node:path'
import fs from 'node:fs/promises'
import { test, is, ok, run } from 'testra'
import { getLastReceivedMessage, startServer } from './server.ts'
import { beforeRelease } from '../before-release.ts'
import { afterRelease } from '../after-release.ts'

// Change current working directory to tests
process.chdir(__dirname)

/**
 * Define environment variables for event, same as GitHub Actions
 */
function defineGitEvent({ repo, refType, ref, refName }) {
  Object.assign(process.env, {
    GITHUB_REPOSITORY: repo, // tangibleinc/example-plugin
    GITHUB_REF_TYPE: refType, // branch or tag
    /**
     * refs/heads/<branch_name>
     * refs/tags/<tag_name>
     * refs/pull/<pr_number>/merge
     */
    GITHUB_REF: ref, // refs/heads/main
    // Branch or tag name
    GITHUB_REF_NAME: refName,
  })
}

const publishPath = './publish'
const zipFileName = 'example-plugin.zip' // Must be same in tangible.config.js

async function clearPublishDirectory() {
  // Empty it

  await fs.rm(publishPath, {
    recursive: true,
    force: true,
  })

  await fs.mkdir(publishPath)
}

async function preparePublishDirectory() {
  await clearPublishDirectory()
  // Create mock zip file
  await fs.writeFile(path.join(publishPath, zipFileName), '123')
}

await startServer()

test('Release for Git commit', async () => {
  defineGitEvent({
    repo: 'tangibleinc/example-plugin',
    refType: 'branch',
    ref: 'refs/heads/main',
    refName: 'main',
  })

  await preparePublishDirectory()
  ok(true, 'prepare publish')

  await beforeRelease()
  ok(true, 'before release')

  ok(await fs.exists(`./publish/release.md`), 'create release.md')
  ok(await fs.exists(`./publish/example-plugin-latest.zip`), 'create example-plugin-latest.zip')

  await afterRelease()
  ok(true, 'after release')

  const metaPath = 'deploy-meta.json'
  const metaExists = await fs.exists(metaPath)
  ok(metaExists, `file created ${metaPath}`)
  if (!metaExists) return

  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'))

  is(meta.type, 'git', 'event type "git"')
  ok(meta.event === 'commit', 'event "commit"')
  ok(meta.branch === 'main', 'git branch "main"')
  ok(meta.source.startsWith('https'), 'event source URL')
})

test('Release for Git tag', async () => {
  const gitTag = '1.0.0'
  defineGitEvent({
    repo: 'tangibleinc/example-plugin',
    refType: 'tag',
    ref: `refs/heads/${gitTag}`,
    refName: gitTag,
  })

  await preparePublishDirectory()
  ok(true, 'prepare publish')

  await beforeRelease()
  ok(true, 'before release')

  ok(await fs.exists(`./publish/release.md`), 'create release.md')
  ok(await fs.exists(`./publish/example-plugin-1.0.0.zip`), 'create example-plugin-1.0.0.zip')

  await afterRelease()
  ok(true, 'after release')

  const metaPath = 'deploy-meta.json'
  const metaExists = await fs.exists(metaPath)
  ok(metaExists, `file created ${metaPath}`)
  if (!metaExists) return

  const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'))

  is(meta.type, 'git', 'event type "git"')
  ok(meta.event === 'tag', 'event "tag"')
  ok(meta.tag === gitTag, `git tag "${gitTag}"`)
  ok(meta.source.startsWith('https'), 'event source URL')
})

run()
