#!/usr/bin/env -S deno run --allow-run=deno,dot

import { parseFlags } from "../../deps.ts";
import { computeGraph, renderGraph } from "./compute.ts";

const flags = parseFlags(Deno.args, {
  alias: {
    output: ['o'],
  },
});
if (flags._.length !== 1) {
  console.error(`usage: cli.ts <path/to/module.ts> [-o output.{png,svg,jpg,jpeg}]`);
  Deno.exit(4);
}

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
  ], new URLSearchParams());
  console.log(await dotProc.captureAllTextOutput());

} else {
  const dotText = await computeGraph(modUrl, new URLSearchParams(), 'dot');
  console.log(dotText);
}
