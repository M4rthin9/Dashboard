<script lang="ts">
  import { onMount } from 'svelte';
  import { Plus, RefreshCw, Shield, Trash2, UserCog } from '@lucide/svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Spinner from '../lib/components/ui/Spinner.svelte';
  import Modal from '../lib/components/ui/Modal.svelte';
  import { auth } from '../lib/store/auth.svelte';
  import { ui } from '../lib/store/ui.svelte';
  import { hasPermission } from '../lib/utils/permissions';
  import { formatDateThai } from '../lib/utils/format';
  import { getUsers, getRoles, createUser, updateUser, deleteUser, createRole } from '../lib/api/endpoints';
  import type { PublicUser, RolePermission } from '../lib/api/types';

  const AVAILABLE_PERMISSIONS = [
    'approve', 'reject', 'approve_discipline', 'reject_discipline', 'approve_participant',
    'cancel', 'confirm_payment', 'export', 'manage_users', 'manage_settings', 'print', 'reject_payment', 'view_detail',
  ] as const;

  let users = $state<PublicUser[]>([]);
  let roles = $state<RolePermission[]>([]);
  let loading = $state(true);
  let error = $state('');

  let mode = $state<'create' | 'edit' | null>(null);
  let target = $state<PublicUser | null>(null);
  let form = $state({ username: '', password: '', role: '', displayName: '' });
  let busy = $state(false);

  let deleteTarget = $state<PublicUser | null>(null);
  let deleting = $state(false);

  let roleModal = $state(false);
  let newRoleName = $state('');
  let newRolePerms = $state<Record<string, boolean>>({});
  let roleBusy = $state(false);

  const isManager = $derived(auth.user?.role === 'Superadmin' || auth.user?.role === 'Admin' || hasPermission(auth.user?.role ?? '', 'manage_users'));

  onMount(fetchData);

  async function fetchData(): Promise<void> {
    loading = true;
    error = '';
    try {
      const [u, r] = await Promise.all([getUsers(), getRoles()]);
      users = (u.users ?? []).sort((a, b) => a.username.localeCompare(b.username));
      roles = (r.roles ?? []).sort((a, b) => a.roleName.localeCompare(b.roleName));
    } catch (err) {
      error = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้';
      ui.showAlert({ title: 'ไม่สามารถโหลดข้อมูลได้', message: error, type: 'error' });
    } finally {
      loading = false;
    }
  }

  function openCreate(): void {
    target = null;
    form = { username: '', password: '', role: roles[0]?.roleName ?? '', displayName: '' };
    mode = 'create';
  }

  function openEdit(u: PublicUser): void {
    target = u;
    form = { username: u.username, password: '', role: u.role, displayName: u.displayName };
    mode = 'edit';
  }

  async function submit(): Promise<void> {
    busy = true;
    try {
      if (mode === 'create') {
        const res = await createUser(form.username.trim(), form.password, form.role, form.displayName.trim() || undefined);
        if (res.status !== 'ok') {
          ui.showAlert({ title: 'ไม่สามารถสร้างผู้ใช้ได้', message: String(res.message ?? 'เกิดข้อผิดพลาด'), type: 'error' });
          return;
        }
        ui.showAlert({ title: 'สร้างผู้ใช้สำเร็จ', message: `สร้างบัญชี ${form.username.trim()} เรียบร้อย`, type: 'success' });
      } else if (target) {
        const fields: { role?: string; displayName?: string; newPassword?: string } = {
          role: form.role,
          displayName: form.displayName.trim(),
        };
        if (form.password) fields.newPassword = form.password;
        const res = await updateUser(target.username, fields);
        if (res.status !== 'ok') {
          ui.showAlert({ title: 'ไม่สามารถแก้ไขผู้ใช้ได้', message: String(res.message ?? 'เกิดข้อผิดพลาด'), type: 'error' });
          return;
        }
        ui.showAlert({ title: 'อัปเดตผู้ใช้สำเร็จ', message: `แก้ไขบัญชี ${target.username} เรียบร้อย`, type: 'success' });
      }
      mode = null;
      await fetchData();
    } catch (err) {
      ui.showAlert({ title: 'เกิดข้อผิดพลาด', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      busy = false;
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    deleting = true;
    try {
      const res = await deleteUser(deleteTarget.username);
      if (res.status !== 'ok') {
        ui.showAlert({ title: 'ไม่สามารถลบผู้ใช้ได้', message: String(res.message ?? 'เกิดข้อผิดพลาด'), type: 'error' });
        return;
      }
      ui.showAlert({ title: 'ลบผู้ใช้สำเร็จ', message: `ลบบัญชี ${deleteTarget.username} เรียบร้อย`, type: 'success' });
      deleteTarget = null;
      await fetchData();
    } catch (err) {
      ui.showAlert({ title: 'เกิดข้อผิดพลาด', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      deleting = false;
    }
  }

  function openRoleModal(): void {
    newRoleName = '';
    newRolePerms = Object.fromEntries(AVAILABLE_PERMISSIONS.map((p) => [p, false]));
    roleModal = true;
  }

  async function submitRole(): Promise<void> {
    const perms = AVAILABLE_PERMISSIONS.filter((p) => newRolePerms[p]);
    if (!newRoleName.trim()) {
      ui.showAlert({ title: 'กรุณากรอกชื่อบทบาท', message: 'ต้องระบุชื่อบทบาทก่อนสร้าง', type: 'warning' });
      return;
    }
    if (perms.length === 0) {
      ui.showAlert({ title: 'กรุณาเลือกสิทธิ์', message: 'กรุณาเลือกอย่างน้อยหนึ่งสิทธิ์', type: 'warning' });
      return;
    }
    roleBusy = true;
    try {
      const res = await createRole(newRoleName.trim(), perms);
      if (res.status !== 'ok') {
        ui.showAlert({ title: 'ไม่สามารถสร้างบทบาทได้', message: String(res.message ?? 'เกิดข้อผิดพลาด'), type: 'error' });
        return;
      }
      ui.showAlert({ title: 'สร้างบทบาทสำเร็จ', message: `สร้างบทบาท ${newRoleName.trim()} เรียบร้อย`, type: 'success' });
      roleModal = false;
      await fetchData();
    } catch (err) {
      ui.showAlert({ title: 'เกิดข้อผิดพลาด', message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      roleBusy = false;
    }
  }
</script>

<div class="flex flex-col gap-4">
  <Card title="ผู้ใช้ระบบ" subtitle="จัดการบัญชีผู้ใช้และบทบาท">
    {#if !isManager}
      <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        คุณไม่มีสิทธิ์จัดการผู้ใช้
      </div>
    {:else}
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm text-slate-500 dark:text-slate-400">ทั้งหมด {users.length} บัญชี</p>
          <div class="flex gap-2">
            <button class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={openRoleModal}>
              <span class="flex items-center gap-1.5"><Shield class="h-4 w-4" /> สร้างบทบาท</span>
            </button>
            <button class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onclick={fetchData} aria-label="โหลดใหม่">
              <RefreshCw class="h-4 w-4" />
            </button>
            <button class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700" onclick={openCreate}>
              <span class="flex items-center gap-1.5"><Plus class="h-4 w-4" /> สร้างผู้ใช้</span>
            </button>
          </div>
        </div>

        {#if loading && users.length === 0}
          <div class="flex items-center justify-center py-16"><Spinner /></div>
        {:else if error}
          <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{error}</div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th class="px-3 py-2 font-medium">ชื่อผู้ใช้</th>
                  <th class="px-3 py-2 font-medium">ชื่อแสดง</th>
                  <th class="px-3 py-2 font-medium">บทบาท</th>
                  <th class="px-3 py-2 font-medium">สร้างเมื่อ</th>
                  <th class="px-3 py-2 text-right font-medium">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {#each users as u (u.username)}
                  <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <td class="px-3 py-2.5 font-medium">{u.username}</td>
                    <td class="px-3 py-2.5 text-slate-600 dark:text-slate-300">{u.displayName}</td>
                    <td class="px-3 py-2.5">
                      <span class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{u.role}</span>
                    </td>
                    <td class="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">{formatDateThai(u.createdAt)}</td>
                    <td class="px-3 py-2.5">
                      <div class="flex items-center justify-end gap-1">
                        <button class="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" title="แก้ไข" onclick={() => openEdit(u)}>
                          <UserCog class="h-4 w-4" />
                        </button>
                        {#if u.username !== auth.user?.username}
                          <button class="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950" title="ลบ" onclick={() => (deleteTarget = u)}>
                            <Trash2 class="h-4 w-4" />
                          </button>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/if}
  </Card>
</div>

<Modal open={mode !== null} title={mode === 'create' ? 'สร้างผู้ใช้' : 'แก้ไขผู้ใช้'} onclose={() => (mode = null)}>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1.5">
      <label for="u-username" class="text-sm font-medium text-slate-700 dark:text-slate-300">ชื่อผู้ใช้</label>
      <input id="u-username" bind:value={form.username} disabled={mode === 'edit'} placeholder="เช่น officer1"
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
    </div>
    <div class="flex flex-col gap-1.5">
      <label for="u-display" class="text-sm font-medium text-slate-700 dark:text-slate-300">ชื่อแสดง</label>
      <input id="u-display" bind:value={form.displayName} placeholder="เช่น พนักงานราชทัณฑ์"
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
    </div>
    <div class="flex flex-col gap-1.5">
      <label for="u-role" class="text-sm font-medium text-slate-700 dark:text-slate-300">บทบาท</label>
      <select id="u-role" bind:value={form.role}
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
        {#each roles as r (r.roleName)}
          <option value={r.roleName}>{r.roleName}</option>
        {/each}
      </select>
    </div>
    <div class="flex flex-col gap-1.5">
      <label for="u-password" class="text-sm font-medium text-slate-700 dark:text-slate-300">
        {mode === 'create' ? 'รหัสผ่าน' : 'รหัสผ่านใหม่ (ปล่อยว่างถ้าไม่เปลี่ยน)'}
      </label>
      <input id="u-password" type="password" bind:value={form.password} placeholder="อย่างน้อย 6 ตัวอักษร"
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
    </div>
    <div class="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
      <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={() => (mode = null)}>ยกเลิก</button>
      <button class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50" onclick={submit} disabled={busy}>
        {busy ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>
    </div>
  </div>
</Modal>

<Modal open={deleteTarget !== null} title="ลบผู้ใช้" onclose={() => (deleteTarget = null)}>
  <div class="flex flex-col gap-4">
    <div class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      ยืนยันการลบผู้ใช้ <span class="font-semibold">{deleteTarget?.username}</span>? การกระทำนี้ไม่สามารถย้อนกลับได้
    </div>
    <div class="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
      <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={() => (deleteTarget = null)}>กลับ</button>
      <button class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50" onclick={confirmDelete} disabled={deleting}>
        {deleting ? 'กำลังลบ...' : 'ลบผู้ใช้'}
      </button>
    </div>
  </div>
</Modal>

<Modal open={roleModal} title="สร้างบทบาท" onclose={() => (roleModal = false)} width="max-w-xl">
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1.5">
      <label for="new-role-name" class="text-sm font-medium text-slate-700 dark:text-slate-300">ชื่อบทบาท</label>
      <input id="new-role-name" bind:value={newRoleName} placeholder="เช่น Officer"
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
    </div>
    <div class="flex flex-col gap-1.5">
      <p class="text-sm font-medium text-slate-700 dark:text-slate-300">สิทธิ์</p>
      <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {#each AVAILABLE_PERMISSIONS as p (p)}
          <label class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <input type="checkbox" checked={newRolePerms[p]} onchange={(e) => (newRolePerms[p] = (e.currentTarget as HTMLInputElement).checked)} class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span class="font-mono text-xs">{p}</span>
          </label>
        {/each}
      </div>
    </div>
    <div class="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
      <button class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" onclick={() => (roleModal = false)}>ยกเลิก</button>
      <button class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50" onclick={submitRole} disabled={roleBusy}>
        {roleBusy ? 'กำลังสร้าง...' : 'สร้างบทบาท'}
      </button>
    </div>
  </div>
</Modal>
