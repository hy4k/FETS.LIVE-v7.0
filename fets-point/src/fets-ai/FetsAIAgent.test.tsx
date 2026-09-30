import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetsAIAgent } from './FetsAIAgent';

const requests=vi.hoisted(()=>vi.fn());
vi.mock('./fets-ai-api',()=>({agentRequest:requests}));
vi.mock('../lib/supabase',()=>({supabase:{from:vi.fn()}}));

describe('persistent work companion',()=>{
  beforeEach(()=>{requests.mockReset();requests.mockImplementation(async(body:{action:string})=>body.action==='status'?{
    ready:true,databaseReady:true,modelReady:true,admin:false,branch:'cochin',sources:[],liveModel:'gemini-3.1-flash-live-preview',textModel:'gemini-3.1-pro-preview',
  }:{text:'Three rostered staff are visible today.',evidence:[{source:'Staff roster',page:'fets-roster',available:true,fetchedAt:'2026-09-29T12:00:00Z',count:3}],proposals:[],model:'gemini-3.1-pro-preview'});});
  it('opens on demand and shows a sourced answer without a media permission prompt',async()=>{
    const navigate=vi.fn();render(<FetsAIAgent userId="staff-1" branch="cochin" page="my-desk" navigate={navigate}/>);
    fireEvent.click(screen.getByRole('button',{name:'Open FETS AI assistant'}));
    await screen.findByText('Connected to your workspace');
    fireEvent.change(screen.getByRole('textbox',{name:'Ask FETS AI'}),{target:{value:'Who is rostered?'}});
    fireEvent.click(screen.getByRole('button',{name:'Send message'}));
    await screen.findByText('Three rostered staff are visible today.');
    fireEvent.click(screen.getByRole('button',{name:'Staff roster'}));
    expect(navigate).toHaveBeenCalledWith('fets-roster');
    expect(requests).toHaveBeenCalledWith(expect.objectContaining({action:'chat',branch:'cochin',page:'my-desk'}));
  });
  it('shows setup pending when the backend has no Gemini server key',async()=>{
    requests.mockImplementation(async()=>({ready:false,databaseReady:true,modelReady:false,admin:false,branch:'cochin',sources:[]}));
    render(<FetsAIAgent userId="staff-1" branch="cochin" page="my-desk" navigate={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Open FETS AI assistant'}));
    await screen.findByText(/The server-side Gemini key is pending/);
    await waitFor(()=>expect(screen.getByRole('button',{name:'Send message'})).toBeDisabled());
  });
});
