
export async function resolveModuleUrl(modSlug: string) {
  if (modSlug.startsWith('gh/')) {
    const [_, owner, repo, ...path] = modSlug.split('/');
    const data = await fetch(`https://api.github.com/repos/${owner}/${repo}`)
    const {default_branch} = await data.json();
    return `https://raw.githubusercontent.com/${owner}/${repo}/${default_branch ?? 'master'}/${path.join('/') || 'deps.ts'}`;

  } else if (modSlug.startsWith('x/')) {
    return `https://deno.land/x/${modSlug.slice(2)}`;

  } else if (modSlug.startsWith('https/')) {
    return `https://${modSlug.slice(6)}`;

  } else {
    return false;
    // throw new Error(`Unrecognized module source type from ${modSlug}`);
  }
}
