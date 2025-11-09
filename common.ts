import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

export const isTestEnvironment = process.env.NODE_ENV === 'test'
const execAsync = promisify(exec)

export type EventMeta = {
  /**
   * Full name of repository: tangibleinc/example-plugin
   */
  repoFullName: string
  eventType: 'branch' | 'tag'
  /**
   * refs/heads/<branch_name>
   * refs/tags/<tag_name>
   * refs/pull/<pr_number>/merge
   */
  gitRef: string
  /**
   * Branch or tag name
   */
  gitRefName: string
  /**
   * Branch name, even in context of "tag" event type
   */
  branchName: string
}

export async function getEventMeta(): Promise<EventMeta> {
  /**
   * [GitHub default environment variables](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables)
   */
  const {
    GITHUB_REPOSITORY: repoFullName = '',
    GITHUB_REF_TYPE: eventType = 'branch',
    GITHUB_REF: gitRef = '',
    GITHUB_REF_NAME: gitRefName = '',
  } = process.env

  /**
   * Necessary to get branch name using `git` because GitHub Actions does not provide
   * branch name via env variable on event type `tag`
   */
  const branchName = eventType === 'tag'
    ? await getBranchNameFromTag(gitRefName)
    : gitRefName

    return {
    repoFullName,
    eventType: eventType as EventMeta['eventType'],
    gitRef,
    gitRefName,
    branchName,
  }
}

export async function getBranchNameFromTag(tag: string): Promise<string> {
  let branchName = tag
  try {
    let result = (
      (await execAsync(`git branch --contains ${tag}`)).stdout || ''
    )
      .replace(/^\* /, '')
      .trim()
    if (result) {
      branchName = result
    }
  } catch (e) {
    console.error(`Failed to get branch name from tag ${branchName}`)
  }
  return branchName
}

export async function getProjectConfig({ projectPath }): Promise<
  | {
      archive?: {
        /**
         * Destination zip file name
         */
        dest: string
        /**
         * Root folder in the archive, usually the plugin name
         */
        root?: string
      }
    }
  | undefined
> {
  const configPath = path.join(projectPath, 'tangible.config.js')

  try {
    return (await import(configPath)).default
  } catch (e) {
    // Not found
  }
}
