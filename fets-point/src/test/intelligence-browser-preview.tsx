/** ISOLATED_BROWSER_FIXTURE_ONLY: bundled solely by build-intelligence-preview.mjs. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { FetsIntelligence } from '../components/FetsIntelligence';
import '../index.css';
(window as any).intelligenceBrowserErrors=[];
class Boundary extends React.Component<React.PropsWithChildren,{error:string}>{
 state={error:''};
 static getDerivedStateFromError(error:Error){return {error:error.message};}
 componentDidCatch(error:Error){(window as any).intelligenceBrowserErrors.push(error.stack||error.message);}
 render(){return this.state.error?<div role="alert">Fixture render failure: {this.state.error}</div>:this.props.children;}
}
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false},mutations:{retry:false}}});
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><Boundary><FetsIntelligence/><Toaster/></Boundary></QueryClientProvider>);
