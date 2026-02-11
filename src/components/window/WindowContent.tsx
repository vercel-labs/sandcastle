"use client";

interface WindowContentProps {
  children: React.ReactNode;
}

export function WindowContent({ children }: WindowContentProps) {
  return (
    <div className="relative flex-1 overflow-auto bg-background-100">
      {children}
    </div>
  );
}
