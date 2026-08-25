import { RUN_OF_SHOW } from "../../src/lib/loop/content";
import { setRunOfShow, getRunOfShow } from "../../src/lib/loop/content-store";

/**
 * The live programme lives in D1 (`run_of_show`), not in the seed — the seed
 * only fills a brand-new event. Volume 1's rows were written before the night
 * was re-planned, so production still said doors 9:00, credited "Mitus", and
 * listed the parked Anthem. This writes the real programme.
 */
(async () => {
  const before = await getRunOfShow("vol-1");
  console.log("before:", before.map((r) => `${r.time} ${r.title}`).join("\n        "));
  await setRunOfShow("vol-1", RUN_OF_SHOW);
  const after = await getRunOfShow("vol-1");
  console.log("\nafter: ", after.map((r) => `${r.time} ${r.title}`).join("\n        "));
})();
