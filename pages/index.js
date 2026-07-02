import dynamic from "next/dynamic";

const SenaCareApp = dynamic(() => import("../components/SenaCareApp"), { ssr: false });

export default function Home() {
  return <SenaCareApp />;
}
