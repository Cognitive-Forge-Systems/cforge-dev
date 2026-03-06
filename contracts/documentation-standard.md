# Documentation Standard

## Rules

### readme-has-commands
- description: README.md must document available commands
- severity: warning
- check: file-contains
- target: README.md
- pattern: cforge-dev

### readme-has-setup
- description: README.md must have setup instructions
- severity: warning
- check: file-contains
- target: README.md
- pattern: npm install

### context-has-stack
- description: CFORGE_DEV.md must define the stack
- severity: error
- check: file-contains
- target: CFORGE_DEV.md
- pattern: "## Stack"

### context-has-rules
- description: CFORGE_DEV.md must define architecture rules
- severity: error
- check: file-contains
- target: CFORGE_DEV.md
- pattern: "## Architecture Rules"
