// Intended to be useful for piping together processes like in a Unix shell

export class SubProcess<Tstdin extends 'piped' | 'null' = 'piped' | 'null'> {
  constructor(
    public label: string,
    public opts: {
      errorPrefix: RegExp,

      cmd: string[];
      env?: Record<string,string>;
      stdin: Tstdin;
    },
  ) {}

  proc = Deno.run({
    stdout: 'piped',
    stderr: 'piped',
    ...this.opts,
    env: {...this.opts.env, 'NO_COLOR': 'yas'},
  });

  #stderrText = Deno
    .readAll(this.proc.stderr)
    .then(raw => {
      if (raw.length == 0) return [];
      const lines = new TextDecoder().decode(raw).split('\n');
      if (lines[lines.length - 1] == '') lines.pop();
      for (const line of lines) {
        console.log(`${this.label}: ${line}`);
      }
      return lines;
    });

  async status() {
    const [stderr, status] = await Promise.all([
      this.#stderrText,
      this.proc.status(),
    ]);
    if (status.code !== 0) {
      const errorText = stderr.find(x => x.match(this.opts.errorPrefix));

      const error = new Error(`Subprocess "${this.label}" (${this.opts.cmd.join(' ')}) failed with ${errorText || `exit code ${status.code}. Sorry about that.`}`);

      (error as SubprocessError).subproc = {
        procLabel: this.label,
        cmdLine: this.opts.cmd,
        exitCode: status.code,
        foundError: errorText,
      };
      throw error;
    }
    return stderr;
  }

  async pipeInto(next: SubProcess<'piped'>) {
    const bytes = await Deno.copy(this.proc.stdout, next.proc.stdin);
    next.proc.stdin.close();
    return {
      pipedBytes: bytes,
      stderr: await this.status(),
    };
  }
  async captureAllOutput() {
    const [data] = await Promise.all([
      Deno.readAll(this.proc.stdout),
      this.status(),
    ]);
    return data;
  }
  async toStreamingResponse(headers: Record<string,string>) {
    this.status(); // throw this away because not really a way of reporting problems mid-stream
    return {
      status: 200,
      body: this.proc.stdout,
      headers: new Headers(headers),
    };
  }
}

interface SubprocessError extends Error {
  subproc: SubprocessErrorData;
}
export interface SubprocessErrorData {
  procLabel: string;
  cmdLine: string[];
  exitCode: number;
  foundError?: string;
}
