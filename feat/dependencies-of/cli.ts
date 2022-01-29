#!/usr/bin/env -S deno run --allow-run=deno,dot

import * as Flags from "https://deno.land/std@0.115.0/flags/mod.ts";
const flags = Flags.parse(Deno.args, {
  alias: {
    output: ['o'],
  },
  boolean: [
    'isolate-std',
    'isolate-files',
  ],
});
if (flags._.length !== 1) {
  console.error(`usage: cli.ts <path/to/module.ts> [-o output.{png,svg,jpg,jpeg}]`);
  Deno.exit(4);
}

const graphParams = new URLSearchParams();
if (flags['isolate-std']) {
  graphParams.set('std', 'isolate');
}
if (flags['isolate-files']) {
  graphParams.set('files', 'isolate');
}

import { computeGraph, renderGraph } from "./compute.ts";

const modUrl = `${flags._[0]}`;
if (flags.output) {

  const ext = flags.output.split('.').slice(-1)[0];
  if (!['png', 'svg', 'jpg', 'jpeg'].includes(ext)) {
    console.error(`use .png or .svg or .jpg or .jpeg for the output file`);
    Deno.exit(5);
  }

  const dotProc = await renderGraph(modUrl, [
    `-o${flags.output}`,
    `-T${ext}`,
  ], graphParams);
  console.log(await dotProc.captureAllTextOutput());

} else {
  const dotText = await computeGraph(modUrl, graphParams, 'dot');
  console.log(dotText);
}
