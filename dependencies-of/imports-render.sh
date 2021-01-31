#!/bin/sh -eu
deno info --unstable --json -- "$1" \
| deno run -- imports-compute.ts "$3" \
| dot -T"${2:-svg}"
