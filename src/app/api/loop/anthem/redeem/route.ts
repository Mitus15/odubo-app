/**
 * Compatibility shim. The redemption route moved to /api/loop/redeem when the
 * anthem tournament was deleted.
 *
 * This is a public POST endpoint and a silent break here is a locked door on
 * the night, so the old path keeps answering for one release. Delete it in the
 * release after this one, once nothing is observed hitting it.
 */
export { POST } from "@/app/api/loop/redeem/route";
