import 'katex/dist/katex.min.css';
import 'prosemirror-view/style/prosemirror.css';
import './app/styles/theme.css';
import './app/styles/global.css';
import './app/styles/app.css';
import { mount } from 'svelte';

const target = document.getElementById('app');

if (!target) {
  throw new Error('Nomo app root was not found.');
}

const searchParams = new URLSearchParams(window.location.search);
const rootComponentPromise =
  searchParams.get('view') === 'settings'
    ? import('./app/components/SettingsWindow.svelte')
    : import('./app/App.svelte');

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
