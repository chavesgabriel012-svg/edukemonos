import { PageShell } from "@/components/site/page-shell";

/** Everything but the landing: study, tutor, teacher panel, review and the information pages. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <PageShell>{children}</PageShell>;
}
