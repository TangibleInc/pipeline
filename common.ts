import path from 'node:path'

export const isTestEnvironment = process.env.NODE_ENV === 'test'

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

  return {
    repoFullName,
    eventType: eventType as EventMeta['eventType'],
    gitRef,
    gitRefName,
  }
}

export async function getProjectConfig({ projectPath }): Promise<{
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
} | undefined> {
  const configPath = path.join(projectPath, 'tangible.config.js')

  try {
    return (await import(configPath)).default
  } catch (e) {
    // Not found
  }
}
