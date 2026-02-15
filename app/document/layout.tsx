import { Suspense } from 'react';

export default function DocumentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<div className="flex h-screen items-center justify-center">加载中...</div>}>{children}</Suspense>;
}
