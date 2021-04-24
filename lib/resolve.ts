// URL -> slug
export async function findModuleSlug(modUrl: string) {
  if (!modUrl.includes('://')) throw new Error(`That doesn't look like an absolute URL!`);
  const url = new URL(modUrl);
  if (url.protocol !== 'https:') throw new Error(`Only https:// URLs are supported at this time`);

  // help out a bit: convert github/gist HTML URLs to raw URLs
  if (url.host === 'github.com') {
    const [owner, repo, type, ref, ...path] = url.pathname.slice(1).split('/');
    if (type === 'blob') {
      return `https/raw.githubusercontent.com/${owner}/${repo}/${ref}/${path.join('/') || 'deps.ts'}`;
    }
  }

  return `${url.protocol.slice(0, -1)}/${url.host}${url.pathname}`;
}

// slug -> URL
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
