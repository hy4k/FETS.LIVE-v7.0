import { describe, expect, it } from 'vitest';
import { usesAdminWorkspace, workspaceFor, hasFeature, WORKSPACE_FEATURES } from './workspace-features';

const ids = (list: { id: string }[]) => list.map(f => f.id);

describe('workspace menu', () => {
  it('never repeats the main menu pages', () => {
    for (const admin of [true, false]) expect(ids(workspaceFor(admin))).not.toEqual(expect.arrayContaining(['live', 'calendar', 'roster', 'desk', 'actionables']));
  });
  it('super admins and Niyas: admin tools, without Raise a case or Dashboard', () => {
    expect(usesAdminWorkspace(false, 'Niyas@fets.in ')).toBe(true);
    const list = ids(workspaceFor(usesAdminWorkspace(true, 'mithun@fets.in')));
    expect(list).toContain('user-management');
    expect(list).toContain('candidate-tracker');
    expect(list).not.toContain('case');
    expect(list).not.toContain('dashboard');
  });
  it('other staff: Team space and the Candidate Tracker, no Raise a case', () => {
    expect(ids(workspaceFor(usesAdminWorkspace(false, 'staff@fets.in')))).toEqual(['candidate-tracker']);
  });
  it('a choice in User Management wins over the default', () => {
    const list = ids(workspaceFor(false, { ws_case: true, ws_fets_chat: false, 'ws_candidate-tracker': false }));
    expect(list).not.toContain('case');
    expect(hasFeature(WORKSPACE_FEATURES.find(f=>f.id==='case')!,false,{ws_case:true})).toBe(true);
    expect(list).not.toContain('candidate-tracker');
  });
});

it('moved tools never repeat in Workspace, including permission overrides',()=>{for(const admin of [true,false]){const menu=ids(workspaceFor(admin,{'ws_system-manager':true,'ws_news-manager':true,'ws_access-hub':true,'ws_fets-chat':true,ws_case:true}));for(const id of ['system-manager','news-manager','fets-chat','access-hub','case','fets-space'])expect(menu).not.toContain(id)}});
