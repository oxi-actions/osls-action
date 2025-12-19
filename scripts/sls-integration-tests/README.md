# sls integration tests fixture

This folder contains a tiny Serverless Framework project used by integration tests.

## What it includes

- `serverless.yml`: minimal service definition (`httpApi` + one function)
- `handler.js`: trivial Lambda handler

## Quick manual check

From the repo root:

```sh
# build the action bundle (creates dist/osls_bundle.* and wrapper logic)
npm run build

# run serverless via your bundled osls wrapper (your test harness will do this)
# (example; exact command depends on osls CLI behavior)
node ./dist/osls_bundle.js --version
```

## Integration test

The steps here are 


### sls print
```sh
node ../../dist/osls_bundle.js print
```

The output should look like this:
```yaml
service: osls-integration-simple
frameworkVersion: '3'
provider:
  name: aws
  runtime: nodejs24.x
  region: us-east-1
  stage: dev
  versionFunctions: true
package:
  individually: true
  patterns:
    - '!**/*'
    - handler.js
  artifactsS3KeyDirname: serverless/osls-integration-simple/dev/code-artifacts
functions:
  hello:
    handler: handler.hello
    events:
      - httpApi:
          path: /hello
          method: get
    name: osls-integration-simple-dev-hello
  goodbye:
    handler: handler.goodbye
    events:
      - httpApi:
          path: /goodbye
          method: get
    name: osls-integration-simple-dev-goodbye
```

### sls package

```sh
node ../../dist/osls_bundle.js package
```

It must not error and it should create the `.serverless` folder.

The following command should list the contents

#### Check the contents of the .serverless folder
```sh
ls -1 .serverless/
```

The expected created files are these:

```sh
cloudformation-template-create-stack.json
cloudformation-template-update-stack.json
goodbye.zip
hello.zip
serverless-state.json
```

#### Check the contents of the zip files
```sh
unzip -l .serverless/hello.zip
```

The expected output should show only one file:
```sh
Archive:  .serverless/hello.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
      181  01-01-1980 00:00   handler.js
---------                     -------
      181                     1 file
```