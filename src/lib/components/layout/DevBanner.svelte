<script lang="ts">
  /**
   * Persistent marker so a dev tab is never mistaken for the live dashboard —
   * approvals and payment confirmations look identical in both. Renders nothing
   * on production, and sets `noindex` on the dev deployment.
   */
  import { isDevDeployment } from '../../env';
  import { API_BASE } from '../../api/client';
</script>

<svelte:head>
  {#if isDevDeployment}
    <meta name="robots" content="noindex, nofollow" />
  {/if}
</svelte:head>

{#if isDevDeployment}
  <div class="dev-banner" role="status">
    <strong>DEVELOPMENT</strong>
    <span>ข้อมูลทดสอบ — ไม่ใช่ระบบจริง</span>
    <code>{API_BASE.replace('https://', '')}</code>
  </div>
{/if}

<style>
  .dev-banner {
    position: sticky;
    top: 0;
    z-index: 9999;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem 0.75rem;
    padding: 0.375rem 0.75rem;
    background: repeating-linear-gradient(
      45deg,
      #b45309,
      #b45309 12px,
      #92400e 12px,
      #92400e 24px
    );
    color: #fff;
    font-size: 0.75rem;
    line-height: 1.4;
    text-align: center;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
  }

  .dev-banner strong {
    letter-spacing: 0.08em;
  }

  .dev-banner code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    background: rgb(0 0 0 / 0.25);
    padding: 0.0625rem 0.375rem;
    border-radius: 0.25rem;
  }
</style>
