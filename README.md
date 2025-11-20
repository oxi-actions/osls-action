# Install osls CLI Action

This GitHub Action installs the `osls` serverless CLI globally in your workflow environment, enabling you to deploy and manage serverless applications.

## Usage

```yaml
steps:
  - uses: actions/checkout@v5
  
  - name: Install osls
    uses: oxi-actions/osls-action@v1
    with:
      # Optional: Specify a version (defaults to 3.59.3)
      osls-version: '3.59.3'

  - name: Deploy Application
    run: sls deploy
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `osls-version` | The version of the `osls` package to install. Can be a specific version (e.g., `3.59.3`) or a tag (e.g., `latest`). | No | `3.59.3` |

## Outputs

| Output | Description |
|--------|-------------|
| `osls-version` | The detected version of `osls` after installation. |
| `osls-path` | The absolute path to the installed `osls` binary. |

## Example with Outputs

```yaml
steps:
  - uses: oxi-actions/osls-action@v1
    id: install-osls
    with:
      osls-version: 'latest'
      
  - name: Check Version
    run: echo "Installed osls version: ${{ steps.install-osls.outputs.osls-version }}"
```

## License

MIT
