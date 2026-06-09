import './app/styles/theme.css';
import './app/styles/global.css';
import { mount } from 'svelte';

const target = document.getElementById('app');

if (!target) {
  throw new Error('Nomo app root was not found.');
}

const searchParams = new URLSearchParams(window.location.search);
const isSettingsView = searchParams.get('view') === 'settings';
const rootComponentPromise = isSettingsView
  ? import('./app/components/SettingsWindow.svelte')
  : Promise.all([
      import('katex/dist/katex.min.css'),
      import('prosemirror-view/style/prosemirror.css'),
      import('./app/styles/app.css'),
    ]).then(() => import('./app/App.svelte'));

const app = rootComponentPromise
  .then(({ default: RootComponent }) =>
    mount(RootComponent, {
      target,
    }),
  )
  .catch((error) => {
    console.error('Failed to mount Nomo app root.', error);
    throw error;
  });

export default app;
