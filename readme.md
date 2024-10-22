# Pipeline

Shared build pipeline for plugins on GitHub and Bitbucket.

Source code: https://github.com/tangibleinc/pipeline

## Features

The goal is to seamlessly upgrade from the previous [Bitbucket Pipeline v2](https://bitbucket.org/tangibleinc/tangible-pipeline-v2/) to GitHub Actions.

- [x] Create zip archive
  - [x] `{plugin}-latest.zip` on Git commit - branch `main` or `master`
  - [x] `{plugin}-{branch}-latest.zip` on Git commit - other branches
  - [x] `{plugin}-{version}.zip` on Git version tag

- [x] Copy zip file to release on project page
  - [x] `Releases` folder on GitHub
  - [x] `Downloads` folder on BitBucket

- [x] Copy zip file to update server
  - [x] On version release, publish to updater
  - [ ] On every commit, publish preview release with plugin name suffix `-preview`

- [x] Deploy metadata to an event API

## Bitbucket Pipeline

Create a file named `bitbucket-pipelines.yml`.

```yaml
# See https://github.com/tangibleinc/pipeline
image: php:8.1-fpm
pipelines:
  # On every commit
  default:
    - step:
        script:
          - curl -sL "https://${BB_AUTH_STRING}@api.bitbucket.org/2.0/repositories/tangibleinc/tangible-pipeline-v3/downloads/run" | bash
  # On every version tag
  tags:
    "*":
      - step:
          script:
            - curl -sL "https://${BB_AUTH_STRING}@api.bitbucket.org/2.0/repositories/tangibleinc/tangible-pipeline-v3/downloads/run" | bash
```

For existing projects, change `v2` to `v3` in the URL of the Bitbucket pipeline script.

Alternatively use the GitHub URL.

```
https://raw.githubusercontent.com/tangibleinc/pipeline/main/run
```

## GitHub Actions

Status: Work in progress

Create a file at `.github/workflows/release.yml`.

```yml
name: Release
permissions:
  contents: write
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - run: git fetch --tags origin
      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
      - name: Install dependencies
        run: bun install
      - name: Create archive
        run: bun run archive -y
      - name: Install pipeline
        run: mkdir -p publish && cd publish && git clone https://github.com/tangibleinc/pipeline
      - name: Before release script
        run: bun run publish/pipeline/before-release.ts
      - name: Release tag
        uses: softprops/action-gh-release@v2
        if: ${{ startsWith(github.ref, 'refs/tags/') }}
        with:
          body_path: publish/release.md
          files: publish/*.zip
      - name: Add latest tag as needed
        uses: EndBug/latest-tag@latest
        if: ${{ ! startsWith(github.ref, 'refs/tags/') }}
      - name: Release preview at latest commit
        uses: softprops/action-gh-release@v2
        if: ${{ ! startsWith(github.ref, 'refs/tags/') }}
        with:
          body_path: publish/release.md
          files: publish/*.zip
          tag_name: latest
          make_latest: true
      - name: After release script
        run: bun run publish/pipeline/after-release.ts
```

### Actions reference

- [GitHub default environment variables](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables)
- [Add latest tag as needed](https://github.com/marketplace/actions/latest-tag)
- [Create release](https://github.com/softprops/action-gh-release)
  - [Uploading release assets](https://github.com/softprops/action-gh-release?tab=readme-ov-file#%EF%B8%8F-uploading-release-assets)

### Private repositories

To give the pipeline access to private repositories, refer to:

- [GitHub Docs - Authentication/Connect with SSH/Managing deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys#deploy-keys)

Use [GitHub Action `ssh-agent`](https://github.com/webfactory/ssh-agent) to pass one or more private keys.

```yml
- uses: webfactory/ssh-agent@v0.9.0
  with:
      ssh-private-key: ${{ secrets.TANGIBLE_PIPELINE_SSH_KEY }}
```
