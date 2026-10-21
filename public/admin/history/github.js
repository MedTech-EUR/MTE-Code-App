/**
 * Content history: talking to GitHub.
 *
 * Sign-in reuses the content editor's own route: the OAuth proxy Worker (backend.base_url and
 * auth_endpoint in /admin/config.yml) runs "Sign in with GitHub" in a popup and hands the token
 * back with postMessage. The token stays in this browser tab (sessionStorage) and is only ever
 * sent to api.github.com.
 *
 * Restores and undos are written with GitHub's Git Data API (blobs, trees, commits, refs): one
 * new commit on top of the branch, never a rewrite of history.
 */

import { base64ToText } from './history-core.js';

const API = 'https://api.github.com';
const TOKEN_KEY = 'mte-code-app-history-token';

export class GitHubError extends Error {
  constructor(status, message) {
    super(message || `GitHub answered ${status}`);
    this.status = status;
  }
}

/** Someone else saved one of the files (or the branch moved) since the editor looked. */
export class ConflictError extends Error {
  constructor(path) {
    super(`“${path}” changed in the meantime`);
    this.path = path;
  }
}

export const storedToken = () => sessionStorage.getItem(TOKEN_KEY);
export const forgetToken = () => sessionStorage.removeItem(TOKEN_KEY);

/**
 * "Sign in with GitHub" through the Worker, exactly as the CMS does it:
 * 1. the popup says "authorizing:github"; 2. we answer the same; 3. it sends
 * "authorization:github:success:{token}" (or ":error:{...}") to this page only.
 */
export function signIn(baseUrl, authEndpoint = 'auth') {
  return new Promise((resolve, reject) => {
    const workerOrigin = new URL(baseUrl).origin;
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/${authEndpoint.replace(/^\//, '')}`);
    url.search = new URLSearchParams({ provider: 'github', site_id: location.hostname, scope: 'repo' }).toString();
    const popup = window.open(url, 'github-sign-in', 'popup,width=640,height=760');
    if (!popup) {
      reject(new Error('popup-blocked'));
      return;
    }
    const onMessage = (event) => {
      if (event.origin !== workerOrigin || event.source !== popup || typeof event.data !== 'string') return;
      if (event.data === 'authorizing:github') {
        popup.postMessage('authorizing:github', event.origin);
        return;
      }
      const match = event.data.match(/^authorization:github:(success|error):([\s\S]*)$/);
      if (!match) return;
      window.removeEventListener('message', onMessage);
      popup.close();
      let content = {};
      try {
        content = JSON.parse(match[2]);
      } catch {
        // handled below as a failed sign-in
      }
      if (match[1] === 'success' && content.token) {
        sessionStorage.setItem(TOKEN_KEY, content.token);
        resolve(content.token);
      } else {
        reject(new Error(content.error || 'sign-in-failed'));
      }
    };
    window.addEventListener('message', onMessage);
  });
}

/** A GitHub client for one repository and branch. Results that never change are cached. */
export function createGitHub({ token, repo, branch, fetchImpl = (...args) => fetch(...args) }) {
  const cache = new Map();

  async function call(path, { method = 'GET', body, allow404 = false } = {}) {
    const response = await fetchImpl(path.startsWith('https://') ? path : `${API}/repos/${repo}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body && JSON.stringify(body),
    });
    if (allow404 && response.status === 404) return null;
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new GitHubError(response.status, detail.message);
    }
    return response.status === 204 ? null : response.json();
  }

  /** Cached GET for things addressed by a commit SHA (they never change). */
  const once = (key, load) => {
    if (!cache.has(key)) cache.set(key, load().catch((error) => (cache.delete(key), Promise.reject(error))));
    return cache.get(key);
  };

  const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

  const api = {
    branch,
    user: () => call(`${API}/user`),
    repository: () => call(''),

    /** Saves on the branch, newest first (optionally only those touching `path`). */
    listCommits: ({ path, page = 1, perPage = 30 } = {}) => {
      const query = new URLSearchParams({ sha: branch, per_page: String(perPage), page: String(page) });
      if (path) query.set('path', path);
      return call(`/commits?${query}`);
    },

    /** One save with its list of changed files. */
    getCommit: (sha) => once(`commit:${sha}`, () => call(`/commits/${sha}`)),

    /** The file at a save: { sha, size, content?, encoding } or null if it did not exist. */
    getFile: (path, ref) => once(`file:${ref}:${path}`, () => call(`/contents/${encodePath(path)}?ref=${ref}`, { allow404: true })),

    /** A file's Git blob ID at a save, or null. */
    blobSha: async (path, ref) => (await api.getFile(path, ref))?.sha ?? null,

    /** A file's text at a save (null if it did not exist). Large files are read as blobs. */
    getText: async (path, ref) => {
      const file = await api.getFile(path, ref);
      if (!file) return null;
      const base64 = file.encoding === 'base64' && file.content ? file.content : (await call(`/git/blobs/${file.sha}`)).content;
      return base64ToText(base64);
    },

    /** The branch's latest save (not cached: it moves). */
    headSha: async () => (await call(`/git/ref/heads/${encodePath(branch)}`)).object.sha,

    /** Stores `text` as a Git blob and returns its ID (the same text always gives the same ID). */
    createBlob: async (text) => (await call('/git/blobs', { method: 'POST', body: { content: text, encoding: 'utf-8' } })).sha,

    /**
     * Puts files in the requested state as one new save on the branch.
     * Every step's file must still be as the editor saw it; otherwise ConflictError
     * and nothing is saved. Returns the new save's SHA, or null if nothing changed.
     */
    applySteps: async (steps, message) => {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const head = await api.headSha();
        const entries = [];
        for (const step of steps) {
          const expected = 'expectedSha' in step ? step.expectedSha : await api.blobSha(step.path, step.expectedRef);
          const current = await api.blobSha(step.path, head);
          if (current !== expected) throw new ConflictError(step.path);
          let target = null;
          if ('text' in step) target = await api.createBlob(step.text);
          else if (step.from) target = await api.blobSha(step.from.path, step.from.ref);
          if (target !== current) entries.push({ path: step.path, mode: '100644', type: 'blob', sha: target });
        }
        if (entries.length === 0) return null;
        const baseTree = (await call(`/git/commits/${head}`)).tree.sha;
        const tree = await call('/git/trees', { method: 'POST', body: { base_tree: baseTree, tree: entries } });
        const commit = await call('/git/commits', { method: 'POST', body: { message, tree: tree.sha, parents: [head] } });
        try {
          await call(`/git/refs/heads/${encodePath(branch)}`, { method: 'PATCH', body: { sha: commit.sha, force: false } });
          return commit.sha;
        } catch (error) {
          // 422: another save landed on the branch a moment ago. Check again on top of it.
          if (!(error instanceof GitHubError && error.status === 422) || attempt === 2) throw error;
        }
      }
      return null;
    },
  };
  return api;
}
