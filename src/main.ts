import App from './app/App.svelte';
import SettingsWindow from './app/components/SettingsWindow.svelte';
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
const RootComponent = searchParams.get('view') === 'settings' ? SettingsWindow : App;

const app = mount(RootComponent, {
  target,
});

export default app;
