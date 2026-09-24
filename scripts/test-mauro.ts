import { prisma } from "../src/lib/db";
import { getOrCreateRuletaConfig } from "../src/lib/ruleta-actions";
import { findRestaurantBySlugOrHistory } from "../src/lib/slugs";

async function testMauro() {
  const slug = "las-empanadas-de-mauro";
  console.log("Testing slug:", slug);
  const slugCheck = await findRestaurantBySlugOrHistory(slug);
  console.log("slugCheck:", slugCheck);

  const targetSlug = slugCheck.targetSlug || slug;
  const rest = await prisma.restaurant.findUnique({
    where: { slug: targetSlug },
  });
  console.log("Restaurant found:", rest?.name, "ID:", rest?.id);

  if (rest) {
    const config = await getOrCreateRuletaConfig(rest.id);
    console.log("Config result:", config);
  }
}

testMauro().catch(console.error);
