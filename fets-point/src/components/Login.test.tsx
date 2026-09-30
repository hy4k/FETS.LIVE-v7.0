import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from './Login';
const mocks = vi.hoisted(() => ({ signIn:vi.fn(), recover:vi.fn() }));
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({signIn:mocks.signIn})}));
vi.mock('../lib/supabase',()=>({supabase:{auth:{resetPasswordForEmail:mocks.recover}}}));
beforeEach(()=>{sessionStorage.setItem('fets-welcome-seen','1');mocks.signIn.mockReset();mocks.recover.mockReset();});
afterEach(()=>{cleanup();sessionStorage.clear();vi.restoreAllMocks();});
describe('premium sign in',()=>{
  it('retains credentials after an error and submits the password unchanged',async()=>{
    mocks.signIn.mockResolvedValue({error:{message:'Invalid login credentials'}});render(<Login/>);
    fireEvent.change(screen.getByLabelText('Work email'),{target:{value:'staff@fets.in'}});
    fireEvent.change(screen.getByLabelText('Password'),{target:{value:'  secret  '}});
    fireEvent.click(screen.getByRole('button',{name:'Show password'}));expect(screen.getByLabelText('Password')).toHaveAttribute('type','text');
    fireEvent.click(screen.getByRole('button',{name:'Step inside'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');
    expect(mocks.signIn).toHaveBeenCalledWith('staff@fets.in','  secret  ');
    expect(screen.getByLabelText('Password')).toHaveValue('  secret  ');
    expect(screen.getByRole('button',{name:'Step inside'})).toBeEnabled();
  });
  it('uses the existing recovery redirect and keeps errors retryable',async()=>{
    mocks.recover.mockResolvedValueOnce({error:new Error('Try again later')}).mockResolvedValue({error:null});render(<Login/>);
    fireEvent.change(screen.getByLabelText('Work email'),{target:{value:'staff@fets.in'}});
    fireEvent.click(screen.getByRole('button',{name:'Forgot password?'}));
    fireEvent.click(screen.getByRole('button',{name:'Send recovery link'}));expect(await screen.findByRole('alert')).toHaveTextContent('Try again later');
    fireEvent.click(screen.getByRole('button',{name:'Send recovery link'}));expect(await screen.findByRole('status')).toHaveTextContent('If this email is registered');
    expect(mocks.recover).toHaveBeenLastCalledWith('staff@fets.in',{redirectTo:`${window.location.origin}/update-password`});
    fireEvent.click(screen.getByRole('button',{name:/Back to sign in/}));expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });
  it('lets a first-time visitor skip the introduction and remembers that within the session',()=>{
    sessionStorage.clear();const view=render(<Login/>);fireEvent.click(screen.getByRole('button',{name:/Continue to sign in/}));
    expect(screen.getByLabelText('Work email')).toBeInTheDocument();view.unmount();render(<Login/>);expect(screen.queryByRole('button',{name:/Continue to sign in/})).not.toBeInTheDocument();
  });
  it('opens the form immediately for reduced motion',()=>{
    sessionStorage.clear();vi.spyOn(window,'matchMedia').mockReturnValue({matches:true} as MediaQueryList);render(<Login/>);expect(screen.getByLabelText('Work email')).toBeInTheDocument();expect(screen.queryByRole('button',{name:/Continue to sign in/})).not.toBeInTheDocument();
  });
});
