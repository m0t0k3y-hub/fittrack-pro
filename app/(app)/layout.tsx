import { BottomNav } from "./bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col pb-20">{children}</div>
      <BottomNav />
    </>
  );
}
