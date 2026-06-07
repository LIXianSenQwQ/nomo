<script lang="ts">
  import { tick } from 'svelte';
  import { slide } from 'svelte/transition';
  import { Check, Trash2, X } from '@lucide/svelte';
  import { clickOutside } from '../actions/clickOutside';
  import { motionIn, transitionDuration } from '../actions/motion';

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

{#if open}
  <div
    class="quick-link-popover"
    style={positionStyle}
    role="dialog"
    aria-label="编辑超链接"
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
        placeholder="标题（显示文字）"
        aria-label="标题"
        on:input={updateText}
      />
      <div class="quick-link-url-row">
        <input
          bind:this={hrefInput}
          class="quick-link-url-input"
          type="text"
          value={href}
          placeholder="https://example.com"
          aria-label="链接地址"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'quick-link-error' : undefined}
          on:input={updateHref}
        />
        <button
          type="submit"
          class="quick-link-primary"
          title="应用链接"
          aria-label="应用链接"
          tabindex="-1"
          on:mousedown|preventDefault
        >
          <Check size={16} />
        </button>
        {#if canRemove}
          <button
            type="button"
            title="移除链接"
            aria-label="移除链接"
            tabindex="-1"
            on:mousedown|preventDefault
            on:click={removeLink}
          >
            <Trash2 size={15} />
          </button>
        {/if}
        <button
          type="button"
          title="关闭"
          aria-label="关闭链接编辑器"
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
