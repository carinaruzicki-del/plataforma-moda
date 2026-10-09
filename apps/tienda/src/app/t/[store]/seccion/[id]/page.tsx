import { Catalog } from '@/components/Catalog';

export default async function SectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Catalog sectionId={id} />;
}
