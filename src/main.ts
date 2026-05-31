import App from './app/App.svelte';
import 'katex/dist/katex.min.css';
import 'prosemirror-view/style/prosemirror.css';
import './app/styles/theme.css';
import './app/styles/global.css';
import './app/styles/app.css';
import { mount } from 'svelte';

const target = document.getElementById('app');

if (!target) {
  throw new Error('NewMd app root was not found.');
}

const app = mount(App, {
  target
});

export default app;
