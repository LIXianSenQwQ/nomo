<script lang="ts">
  import { tick } from 'svelte';
  import { slide } from 'svelte/transition';
  import { Check, Trash2, X } from '@lucide/svelte';
  import { clickOutside } from '../actions/clickOutside';
  import { motionIn, transitionDuration } from '../actions/motion';
  import { t } from '../i18n';

  export let interfaceLocale: string;
  export let open: boolean;
  export let text: string;
  export let href: string;
  export let error: string;
  export let canRemove: boolean;
  export let positionStyle: string;
  export let updateText: (event: Event) => void;
  export let updateHref: (event: Event) => void;
  export let applyLink: () => void;
  export let removeLink: () => void;
  export let closeLinkPicker: () => void;

  let titleInput: HTMLInputElement;
  let hrefInput: HTMLInputElement;
  let wasOpen = false;

  $: if (open && !wasOpen) {
    wasOpen = true;
    focusInitialInput();
  }

  $: if (!open && wasOpen) {
    wasOpen = false;
  }

  async function focusInitialInput() {
    await tick();
    titleInput?.focus();
    titleInput?.select();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLinkPicker();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const targetInput = document.activeElement === titleInput ? hrefInput : titleInput;
      targetInput?.focus();
      targetInput?.select();
    }
  }
</script>

{#key interfaceLocale}
{#if open}
  <div
    class="quick-link-popover"
    data-interface-locale={interfaceLocale}
    style={positionStyle}
    role="dialog"
    aria-label={t.editLink()}
    tabindex="-1"
    use:clickOutside={closeLinkPicker}
    use:motionIn={{ kind: 'popover', y: -4, scale: 0.98 }}
    on:keydown={handleKeydown}
  >
    <form class:has-remove={canRemove} on:submit|preventDefault={applyLink}>
      <input
        bind:this={titleInput}
        class="quick-link-title-input"
        type="text"
        value={text}
        placeholder={t.linkTitlePlaceholder()}
        aria-label={t.linkTitle()}
        on:input={updateText}
      />
      <div class="quick-link-url-row">
        <input
          bind:this={hrefInput}
          class="quick-link-url-input"
          type="text"
          value={href}
          placeholder="https://example.com"
          aria-label={t.linkHref()}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'quick-link-error' : undefined}
          on:input={updateHref}
        />
        <button
          type="submit"
          class="quick-link-primary"
          title={t.applyLink()}
          aria-label={t.applyLink()}
          tabindex="-1"
          on:mousedown|preventDefault
        >
          <Check size={16} />
        </button>
        {#if canRemove}
          <button
            type="button"
            title={t.removeLink()}
            aria-label={t.removeLink()}
            tabindex="-1"
            on:mousedown|preventDefault
            on:click={removeLink}
          >
            <Trash2 size={15} />
          </button>
        {/if}
        <button
          type="button"
          title={t.close()}
          aria-label={t.closeLinkEditor()}
          tabindex="-1"
          on:mousedown|preventDefault
          on:click={closeLinkPicker}
        >
          <X size={16} />
        </button>
      </div>
    </form>
    {#if error}
      <p
        id="quick-link-error"
        class="quick-link-error"
        role="alert"
        transition:slide={{ duration: transitionDuration('micro') }}
      >
        {error}
      </p>
    {/if}
  </div>
{/if}
{/key}
