import HomeClient from './HomeClient';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const isMock = params.mock === '1';
  return <HomeClient isMock={isMock} />;
}
