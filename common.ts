
export async function getEventMeta() {

  const {
    GITHUB_REPOSITORY: repoFullName, // tangible/example-plugin
    GITHUB_REF_TYPE: eventType, // branch or tag
    /**
     * refs/heads/<branch_name>
     * refs/tags/<tag_name>
     * refs/pull/<pr_number>/merge
     */
    GITHUB_REF: gitRef,
    // Branch or tag name
    GITHUB_REF_NAME: gitRefName = 'unknown',
  } = process.env

  return {
    repoFullName,
    eventType,
    gitRef,
    gitRefName,
  }
} 
