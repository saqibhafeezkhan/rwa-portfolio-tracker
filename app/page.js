import HomePage from '@/components/HomePage';

/** Server Component — unwrap async route props (Next.js 15+). */
export default async function Page(props) {
  if (props.params) await props.params;
  if (props.searchParams) await props.searchParams;

  return <HomePage />;
}
