import { Studio } from "@/components/Studio";
import { starterTemplates } from "@/lib/templates";

export default function HomePage() {
  return <Studio templates={starterTemplates} />;
}
