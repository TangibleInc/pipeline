# Pipeline

Shared build pipeline for plugins on GitHub and Bitbucket.

## Features

The goal is to seamlessly upgrade from the previous [Bitbucket Pipeline v2](https://bitbucket.org/tangibleinc/tangible-pipeline-v2/) to GitHub Actions.

- [ ] Create zip archive
  - [ ] `{plugin}-latest.zip` on Git commit - branch `main` or `master`
  - [ ] `{plugin}-{branch}-latest.zip` on Git commit - other branches
  - [ ] `{plugin}-{version}.zip` on Git version tag

- [ ] Copy zip file to release on project page
  - [ ] `Releases` folder on GitHub
  - [ ] `Downloads` folder on BitBucket

- [ ] Copy zip file to update server
  - [ ] On version release, publish to updater
  - [ ] On every commit, publish preview release with plugin name suffix `-preview`

- Send message to a central API for logging the event

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
          - curl -sL "https://raw.githubusercontent.com/tangibleinc/pipeline/main/run" | bash
  # On every version tag
  tags:
    "*":
      - step:
          script:
            - curl -sL "https://raw.githubusercontent.com/tangibleinc/pipeline/main/run" | bash
```

## GitHub Actions

Create a file at `.github/workflows/release.yml`.

```yml
name: Release
permissions:
  contents: read
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install github:tangibleinc/pipeline
      - run: bun run node_modules/@tangible/pipeline/index.ts
```

### Private repositories

To give the pipeline access to private repositories, refer to:

- [GitHub Docs - Authentication/Connect with SSH/Managing deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys#deploy-keys)

Use [GitHub Action `ssh-agent`](https://github.com/webfactory/ssh-agent) to pass one or more private keys.

```yml
- uses: webfactory/ssh-agent@v0.9.0
  with:
      ssh-private-key: ${{ secrets.TANGIBLE_PIPELINE_SSH_KEY }}
```
