# Repository Standard

## Rules

### require-readme
- description: Repository must have a README.md
- severity: error
- check: file-exists
- target: README.md

### require-gitignore
- description: Repository must have a .gitignore
- severity: error
- check: file-exists
- target: .gitignore

### require-context-file
- description: Repository must have a CFORGE_DEV.md context file
- severity: error
- check: file-exists
- target: CFORGE_DEV.md

### require-idea-doc
- description: Repository must have a vision document
- severity: warning
- check: file-exists
- target: IDEA_DEV.md

### require-ci-workflow
- description: Repository must have a GitHub Actions CI workflow
- severity: error
- check: file-exists
- target: .github/workflows/ci.yml
