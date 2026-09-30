import { BrandLoader } from '../redesign/BrandExperience';
interface LoadingFallbackProps { message?: string; size?: 'sm' | 'md' | 'lg'; showLogo?: boolean }
export function LoadingFallback({ message = 'Getting things ready', size = 'md', showLogo = true }: LoadingFallbackProps) {
  if (!showLogo) return <div role="status" style={{ padding:24, textAlign:'center', color:'inherit', fontSize:13 }}>{message}</div>;
  return <BrandLoader message={message} fullScreen={size === 'lg'} />;
}
export function PageLoadingFallback({ pageName }: { pageName: string }) { return <LoadingFallback message={`Opening ${pageName}…`} />; }
export function ComponentLoadingFallback({ componentName }: { componentName: string }) { return <LoadingFallback message={`Loading ${componentName}…`} size="sm" showLogo={false} />; }
export function RouteLoadingFallback() { return <BrandLoader message="Opening your workspace" fullScreen />; }
