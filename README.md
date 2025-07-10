# lh-guard

To install dependencies:

```bash
bun install
```

Example to run:

```bash
bun main.ts --operator example --profile stage
```

Example to run with container:

```bash
docker run --rm -v "$(pwd)":/app \
    -e OPERATOR=example \
    -e ENV=stage \
    -e SUPABASE_URL=<your url> \
    -e SUPABASE_KEY=<your_key> \
    matcloud/lh-guard
```

This project was created using `bun init` in bun v1.2.13. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
