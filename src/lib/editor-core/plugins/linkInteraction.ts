import { Plugin } from 'prosemirror-state';
import { canOpenLinkHref } from '../link';

interface LinkInteractionOptions {
  openLink?: (href: string) => void;
}

export function linkInteractionPlugin(options: LinkInteractionOptions = {}): Plugin {
  let activeLink: HTMLAnchorElement | null = null;

  function clearActiveLink(view?: { dom: HTMLElement }) {
    activeLink?.classList.remove('is-modifier-open-target');
    activeLink = null;
    view?.dom.classList.remove('has-modifier-link-hover');
  }

  function setActiveLink(view: { dom: HTMLElement }, link: HTMLAnchorElement) {
    if (activeLink === link) return;
    clearActiveLink(view);
    activeLink = link;
    activeLink.classList.add('is-modifier-open-target');
    view.dom.classList.add('has-modifier-link-hover');
  }

  function updateHoverTarget(view: { dom: HTMLElement }, event: MouseEvent): boolean {
    if (!event.ctrlKey && !event.metaKey) {
      clearActiveLink(view);
      return false;
    }

    const target = findLinkElement(event);
    const href = target?.getAttribute('href') ?? '';
    if (!target || !canOpenLinkHref(href)) {
      clearActiveLink(view);
      return false;
    }

    setActiveLink(view, target);
    return true;
  }

  return new Plugin({
    props: {
      handleDOMEvents: {
        mousemove(view, event) {
          updateHoverTarget(view, event);
          return false;
        },
        mouseleave(view) {
          clearActiveLink(view);
          return false;
        },
        keyup(view, event) {
          if (!event.ctrlKey && !event.metaKey) clearActiveLink(view);
          return false;
        },
        blur(view) {
          clearActiveLink(view);
          return false;
        },
      },
      handleClick(view, _pos, event) {
        if (!event.ctrlKey && !event.metaKey) return false;

        const target = findLinkElement(event);
        if (!target) return false;

        const href = target.getAttribute('href') ?? '';
        if (!canOpenLinkHref(href)) return false;

        event.preventDefault();
        target.classList.add('is-link-opening');
        window.setTimeout(() => target.classList.remove('is-link-opening'), 900);
        if (options.openLink) {
          options.openLink(href);
        } else {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
        view.focus();
        return true;
      },
    },
  });
}

function findLinkElement(event: MouseEvent): HTMLAnchorElement | null {
  const target = event.target;
  if (target instanceof Element) {
    return target.closest<HTMLAnchorElement>('a[href]');
  }

  if (target instanceof Text) {
    return target.parentElement?.closest<HTMLAnchorElement>('a[href]') ?? null;
  }

  for (const item of event.composedPath()) {
    if (item instanceof HTMLAnchorElement && item.hasAttribute('href')) {
      return item;
    }
    if (item instanceof Element) {
      const link = item.closest<HTMLAnchorElement>('a[href]');
      if (link) return link;
    }
  }

  return null;
}
