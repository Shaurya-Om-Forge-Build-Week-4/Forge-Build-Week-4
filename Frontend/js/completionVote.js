import { getContracts } from "./blockchain.js";

export async function voteCompletion(problemId, solved) {
  const { voting } = await getContracts();
  const tx = await voting.voteCompletion(problemId, solved);
  await tx.wait();
}
